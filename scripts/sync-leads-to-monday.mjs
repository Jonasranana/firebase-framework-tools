// Synchronise les leads du simulateur (Firestore, collection ip5_leads)
// vers le tableau Monday "Pac Pac😀" — tableau unique de l'équipe
// commerciale (ex-tableau dédié "Lead venant du site internet", fusionné
// le 2026-09-17 à la demande d'IP5 : un seul tableau, pas une collection
// de tableaux séparés).
//
// Lancé toutes les 15 minutes par .github/workflows/sync-leads-monday.yml.
// Aucune dépendance npm : Node 20+ (fetch et crypto natifs) suffit.
//
// Variables d'environnement requises :
//   GOOGLE_APPLICATION_CREDENTIALS  chemin du JSON de compte de service Firebase
//   MONDAY_API_TOKEN                jeton API Monday (profil > Développeurs)

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const PROJECT_ID = "kachoto-7554c";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Tableau Monday "Pac Pac😀" (déjà utilisé quotidiennement par l'équipe
// commerciale — Mebarek, Carole, Julien, Alexis). Si le tableau est
// supprimé/recréé, mettre à jour ces valeurs.
const MONDAY_BOARD_ID = "18410104402";
// Groupes d'arrivée créés le 2026-09-17, positionnés en haut du tableau
// (avant les groupes de pipeline existants Potentiel/Opportunité/etc.),
// pour que les nouveaux leads restent bien visibles et séparés du suivi en
// cours. group_mm79ghrj = "📥 Nouveaux leads du site" : filet de sécurité
// pour les leads de l'accueil ou toute nouvelle source non prévue.
const MONDAY_GROUP_DEFAULT = "group_mm79ghrj";
const MONDAY_GROUP_PAC = "group_mm791gbb"; // "🔥 Leads PAC (pompe à chaleur)"
const MONDAY_GROUP_SOLAIRE = "group_mm79vwvs"; // "☀️ Leads Solaire (eau chaude & chauffage)"
const MONDAY_GROUP_SMS = "group_mm79vvqb"; // "📲 Réactivation SMS" (relance de l'ancienne base)
// "🚗 Leads Station de gonflage (pro)" — produit B2B (fiche CEE TRA-SE-104),
// distinct des leads particuliers PAC/Solaire (voir CampagneGonflage.tsx).
const MONDAY_GROUP_GONFLAGE = "group_mm79njmh";

// Choisit le groupe Monday selon la « source » du lead (ex. « landing-pac-meta »,
// « landing-solaire-insta »). On teste par mot-clé pour rester robuste si les
// libellés de source évoluent ; à défaut, le groupe général.
const groupForSource = (source) => {
  const s = String(source ?? "").toLowerCase();
  // Les relances SMS (source « sms-… ») vont dans leur propre groupe, quel
  // que soit le produit (le produit est indiqué par la colonne « Projet »).
  if (s.includes("sms")) return MONDAY_GROUP_SMS;
  if (s.includes("gonflage")) return MONDAY_GROUP_GONFLAGE;
  if (s.includes("solaire")) return MONDAY_GROUP_SOLAIRE;
  if (s.includes("pac")) return MONDAY_GROUP_PAC;
  return MONDAY_GROUP_DEFAULT;
};
// Id interne (pas la position d'affichage) des libellés de la colonne
// "🏷️ Type de lead" (color_mm79bwsw) — Monday adresse un statut par son id
// de libellé dans { index: N }, qui ne correspond pas forcément à sa
// position dans la liste déroulante.
const typeLeadIndexForSource = (source) => {
  const s = String(source ?? "").toLowerCase();
  if (s.includes("sms")) return 4; // 📲 SMS
  if (s.includes("gonflage")) return 8; // 🚗 Gonflage
  if (s.includes("solaire")) return 2; // ☀️ Solaire
  if (s.includes("pac")) return 1; // 🔥 PAC
  return 17; // Autre
};

// Colonnes du tableau "Pac Pac😀" (différentes de l'ancien tableau dédié :
// ce tableau existait déjà pour le suivi commercial CEE PAC, donc on
// réutilise ses colonnes existantes plutôt que d'en recréer).
const COL = {
  statutAppel: "color_mm6vdhz4", // 📞 Statut Appel
  typeLead: "color_mm79bwsw", // 🏷️ Type de lead
  telephone: "phone_mm2qnqr2", // 📞 Téléphone
  dateContact: "date_mm6vw6b2", // Date 1er contact
  codePostal: "text_mm2qf4s7", // 📍 Code postal (on y met le n° de département)
  foyer: "text_mm747bpc", // Personnes au foyer
  revenus: "text_mm6zss8", // Tranche de revenus
  chauffage: "text_mm747sr4", // Chauffage actuel
  surface: "numeric_mm2q4jsz", // 📐 Surface
  email: "email_mm2qmb9n", // 📧 Email
  source: "text_mm76vm3v", // Source
  projet: "text_mm76rsb3", // 🔧 Projet
  // Pas de colonne dédiée sur ce tableau pour le type de logement, le statut
  // propriétaire, l'échéance projet, ni les champs pro "Station de
  // gonflage" (contact, type de site, nb de véhicules) : on les regroupe
  // dans les notes plutôt que de les perdre (voir buildNotes ci-dessous).
  notes: "text_mm2qhek4", // 📝 Notes rapides appel
};

// Certains champs du formulaire site n'ont pas de colonne dédiée sur ce
// tableau (voir COL ci-dessus) : on les regroupe en une note lisible plutôt
// que de les perdre.
const buildNotes = (f) => {
  const lines = [];
  if (f.housingType) lines.push(`Logement : ${f.housingType}`);
  if (f.ownerStatus) lines.push(`Propriétaire : ${f.ownerStatus}`);
  if (f.projectTiming) lines.push(`Échéance : ${f.projectTiming}`);
  if (f.contact) lines.push(`Contact pro : ${f.contact}`);
  if (f.typeSite) lines.push(`Type de site : ${f.typeSite}`);
  if (f.nbVehicules) lines.push(`Nb véhicules : ${f.nbVehicules}`);
  return lines.join(" — ");
};

// Le formulaire enregistre le département sous la forme "75 - Paris" ; les
// formules Région/Zone climatique du tableau ne lisent que les 2 premiers
// caractères de la colonne "Code postal", donc le n° de département seul
// suffit à les faire fonctionner correctement.
const departementCode = (department) => String(department ?? "").slice(0, 2);

const mondayToken = process.env.MONDAY_API_TOKEN;
if (!mondayToken) {
  console.error("MONDAY_API_TOKEN manquant");
  process.exit(1);
}

// --- Auth Google : JWT signé avec la clé du compte de service, échangé
// --- contre un access token OAuth (portée Firestore).
async function getGoogleAccessToken() {
  const sa = JSON.parse(
    readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"),
  );
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const unsigned =
    b64({ alg: "RS256", typ: "JWT" }) +
    "." +
    b64({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: sa.token_uri,
      iat,
      exp: iat + 3600,
    });
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key, "base64url");
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Échec du jeton Google (${res.status}): ${await res.text()}`);
  }
  return (await res.json()).access_token;
}

// --- Lecture Firestore : valeurs typées -> valeurs JS simples.
const fromFirestoreValue = (v) => {
  if (v == null) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  return undefined;
};

async function fetchUnsyncedLeads(token) {
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "ip5_leads" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "mondaySynced" },
            op: "EQUAL",
            value: { booleanValue: false },
          },
        },
        limit: 50,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Échec de la requête Firestore (${res.status}): ${await res.text()}`);
  }
  const rows = await res.json();
  return rows
    .filter((r) => r.document)
    .map((r) => {
      const fields = {};
      for (const [k, v] of Object.entries(r.document.fields ?? {})) {
        fields[k] = fromFirestoreValue(v);
      }
      return { name: r.document.name, fields };
    });
}

async function markSynced(token, docName, mondayItemId) {
  const url =
    `https://firestore.googleapis.com/v1/${docName}` +
    `?updateMask.fieldPaths=mondaySynced&updateMask.fieldPaths=mondayItemId`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        mondaySynced: { booleanValue: true },
        mondayItemId: { stringValue: String(mondayItemId) },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Échec du marquage Firestore (${res.status}): ${await res.text()}`);
  }
}

// --- Côté Monday.
// La colonne "phone" de Monday refuse les espaces et séparateurs : on ne
// garde que les chiffres, et on ramène les +33 au format 0X XX XX XX XX.
const normalizePhone = (raw) => {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("33") && digits.length === 11) {
    digits = "0" + digits.slice(2);
  }
  return digits;
};

const parisDate = (iso) =>
  new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(iso ? new Date(iso) : new Date());

async function createMondayItem(lead) {
  const f = lead.fields;
  const columnValues = {
    // Statut « nouveau lead » = "À appeler" (id de libellé 17 sur cette
    // colonne — vérifié via get_board_info, pas déductible de sa position
    // d'affichage). On cible l'id plutôt que le texte : ainsi, renommer
    // l'étiquette dans Monday ne casse plus la synchronisation.
    [COL.statutAppel]: { index: 17 },
    [COL.typeLead]: { index: typeLeadIndexForSource(f.source) },
    [COL.telephone]: { phone: normalizePhone(f.phone), countryShortName: "FR" },
    [COL.dateContact]: { date: parisDate(f.createdAt) },
    [COL.codePostal]: departementCode(f.department),
    [COL.foyer]: String(f.householdSize ?? ""),
    [COL.revenus]: String(f.incomeBracket ?? ""),
    [COL.chauffage]: String(f.currentHeating ?? ""),
    [COL.surface]: String(f.surface ?? ""),
    [COL.source]: String(f.source ?? "site-internet"),
    [COL.projet]: String(f.projectType ?? ""),
    [COL.notes]: buildNotes(f),
  };
  const email = String(f.email ?? "").trim();
  if (email) {
    columnValues[COL.email] = { email, text: email };
  }
  const query = `mutation ($board: ID!, $group: String!, $name: String!, $values: JSON!) {
    create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id }
  }`;
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: mondayToken,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({
      query,
      variables: {
        board: MONDAY_BOARD_ID,
        group: groupForSource(f.source),
        name: String(f.name ?? "Lead sans nom").slice(0, 255),
        values: JSON.stringify(columnValues),
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors?.length || !body.data?.create_item?.id) {
    throw new Error(`Échec de création Monday: ${JSON.stringify(body)}`);
  }
  return body.data.create_item.id;
}

// --- Boucle principale.
const googleToken = await getGoogleAccessToken();
const leads = await fetchUnsyncedLeads(googleToken);
if (leads.length === 0) {
  console.log("Aucun nouveau lead à synchroniser.");
  process.exit(0);
}
console.log(`${leads.length} lead(s) à synchroniser vers Monday…`);

let failures = 0;
for (const lead of leads) {
  try {
    const itemId = await createMondayItem(lead);
    await markSynced(googleToken, lead.name, itemId);
    // Pas de données personnelles dans les logs (dépôt public).
    console.log(`OK: ${lead.name.split("/").pop()} -> item Monday ${itemId}`);
  } catch (err) {
    failures += 1;
    console.error(`ÉCHEC pour ${lead.name.split("/").pop()}: ${err.message}`);
  }
}
if (failures > 0) process.exit(1);
