// Synchronise les leads du simulateur (Firestore, collection ip5_leads)
// vers le tableau Monday "Lead venant du site internet".
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

// Identifiants du tableau Monday (créé le 2026-07-07). Si le tableau est
// supprimé/recréé, mettre à jour ces valeurs.
const MONDAY_BOARD_ID = "18420831671";
const MONDAY_GROUP_ID = "group_mm51rzdz"; // groupe "📥 Nouveaux leads du site"
const COL = {
  statut: "color_mm51cvw8",
  telephone: "phone_mm51zq5n",
  recuLe: "date_mm51nnzy",
  typeLogement: "text_mm51p4ha",
  proprietaire: "text_mm51r815",
  surface: "numeric_mm515v32",
  chauffage: "text_mm51r1ad",
  departement: "text_mm51x68t",
  foyer: "text_mm51n2s9",
  revenus: "text_mm51r5ff",
  echeance: "text_mm51k07s",
  email: "email_mm5178r7",
  source: "text_mm51e0cv",
};

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
    // Statut « nouveau lead » = première étiquette de la colonne (index 0).
    // On cible l'index plutôt que le texte : ainsi, renommer l'étiquette dans
    // Monday (ex. « Nouveau » → « New ») ne casse plus la synchronisation.
    [COL.statut]: { index: 0 },
    [COL.telephone]: { phone: normalizePhone(f.phone), countryShortName: "FR" },
    [COL.recuLe]: { date: parisDate(f.createdAt) },
    [COL.typeLogement]: String(f.housingType ?? ""),
    [COL.proprietaire]: String(f.ownerStatus ?? ""),
    [COL.surface]: String(f.surface ?? ""),
    [COL.chauffage]: String(f.currentHeating ?? ""),
    [COL.departement]: String(f.department ?? ""),
    [COL.foyer]: String(f.householdSize ?? ""),
    [COL.revenus]: String(f.incomeBracket ?? ""),
    [COL.echeance]: String(f.projectTiming ?? ""),
    [COL.source]: String(f.source ?? "site-internet"),
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
        group: MONDAY_GROUP_ID,
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
