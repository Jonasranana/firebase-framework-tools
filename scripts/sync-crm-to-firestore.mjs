// Copie les leads issus du site internet vers la collection Firestore
// "crm_clients", pour l'onglet Clients de l'Espace Pro
// (client/src/pages/ClientsCRM.tsx). Le jeton Monday reste côté serveur ;
// la lecture côté client est protégée par les règles Firestore (auth
// Google + liste blanche d'e-mails, voir OutilDevis.tsx).
//
// Depuis le 2026-09-17, les leads du site vivent dans le tableau Monday
// "Pac Pac😀" (partagé avec toute l'équipe commerciale, voir
// sync-leads-to-monday.mjs), dans un groupe d'arrivée dédié plutôt que sur
// un tableau séparé. On ne récupère QUE ce groupe (pas les ~3500 autres
// dossiers du tableau) : c'est lui qui correspond aux leads du site
// internet (PAC/Solaire/SMS/Gonflage, distingués par la colonne
// "🏷️ Type de lead").
//
// Lancé toutes les 15 minutes par .github/workflows/sync-crm-data.yml.
//
// Variables d'environnement requises :
//   GOOGLE_APPLICATION_CREDENTIALS  chemin du JSON de compte de service Firebase
//   MONDAY_API_TOKEN                jeton API Monday

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const PROJECT_ID = "kachoto-7554c";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const BOARD_ID = "18410104402"; // "Pac Pac😀"
// Groupe d'arrivée unique des leads du site internet (voir
// sync-leads-to-monday.mjs — un seul groupe pour toutes les sources, la
// colonne "🏷️ Type de lead" distingue PAC/Solaire/SMS/Gonflage).
const LEAD_GROUP_IDS = ["group_mm79ghrj"]; // "📥 Nouveaux leads du site internet"

const COL_IDS = [
  "color_mm6vdhz4", // 📞 Statut Appel
  "text_mm2qhek4", // 📝 Notes rapides appel (détail regroupé à la création)
  "phone_mm2qnqr2", // 📞 Téléphone
  "date_mm6vw6b2", // Date 1er contact
  "text_mm6zss8", // Tranche de revenus
  "numeric_mm2q4jsz", // 📐 Surface
  "text_mm747sr4", // Chauffage actuel
  "text_mm2qf4s7", // 📍 Code postal (n° de département)
  "text_mm747bpc", // Personnes au foyer
  "text_mm76vm3v", // Source
  "email_mm2qmb9n", // 📧 Email
  "text_mm76rsb3", // 🔧 Projet
];

const mondayToken = process.env.MONDAY_API_TOKEN;
if (!mondayToken) {
  console.error("MONDAY_API_TOKEN manquant");
  process.exit(1);
}

// --- Auth Google : JWT signé avec la clé du compte de service, échangé
// --- contre un access token OAuth (portée Firestore). Identique à
// --- sync-leads-to-monday.mjs.
async function getGoogleAccessToken() {
  const sa = JSON.parse(
    readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"),
  );
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
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

async function mondayQuery(query, variables) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: mondayToken,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors?.length) {
    throw new Error(`Échec API Monday: ${JSON.stringify(body)}`);
  }
  return body.data;
}

// Ne récupère que les 5 groupes d'arrivée des leads du site (voir
// LEAD_GROUP_IDS) — pas l'ensemble des ~3500 dossiers du tableau partagé.
async function fetchAllItems() {
  const query = `query ($board: ID!, $groups: [String!], $cols: [String!], $cursor: String) {
    boards(ids: [$board]) {
      groups(ids: $groups) {
        title
        items_page(limit: 100, cursor: $cursor) {
          cursor
          items {
            id
            name
            created_at
            column_values(ids: $cols) { id text }
          }
        }
      }
    }
  }`;
  const items = [];
  for (const groupId of LEAD_GROUP_IDS) {
    let cursor = null;
    do {
      const data = await mondayQuery(query, {
        board: BOARD_ID,
        groups: [groupId],
        cols: COL_IDS,
        cursor,
      });
      const group = data.boards[0].groups[0];
      const page = group.items_page;
      for (const item of page.items) {
        items.push({ ...item, group: { title: group.title } });
      }
      cursor = page.cursor;
    } while (cursor);
  }
  return items;
}

const colText = (item, id) =>
  item.column_values.find((c) => c.id === id)?.text?.trim() || "";

const telHref = (phoneText) => {
  const cleaned = phoneText.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
};

const str = (v) => ({ stringValue: v ?? "" });

async function upsertClient(token, item) {
  const phone = colText(item, "phone_mm2qnqr2");
  const fields = {
    name: str(item.name),
    groupe: str(item.group?.title),
    statut: str(colText(item, "color_mm6vdhz4")),
    commentaire: str(colText(item, "text_mm2qhek4")),
    telephone: str(phone),
    telHref: str(telHref(phone)),
    recuLe: str(colText(item, "date_mm6vw6b2")),
    email: str(colText(item, "email_mm2qmb9n")),
    projet: str(colText(item, "text_mm76rsb3")),
    source: str(colText(item, "text_mm76vm3v")),
    departement: str(colText(item, "text_mm2qf4s7")),
    // Type de logement, statut propriétaire, échéance projet, et champs pro
    // "Station de gonflage" (contact/type de site/nb véhicules) n'ont pas de
    // colonne dédiée sur ce tableau partagé : ils sont dans "commentaire"
    // (voir buildNotes dans sync-leads-to-monday.mjs), pas de doublon ici.
    typeLogement: str(""),
    surface: str(colText(item, "numeric_mm2q4jsz")),
    chauffage: str(colText(item, "text_mm747sr4")),
    proprietaire: str(""),
    foyer: str(colText(item, "text_mm747bpc")),
    revenus: str(colText(item, "text_mm6zss8")),
    echeance: str(""),
    contactPro: str(""),
    typeSite: str(""),
    nbVehicules: str(""),
    createdAt: str(item.created_at),
  };
  // updateMask : ne touche qu'aux champs issus de Monday. Les champs
  // "internes" ajoutés depuis l'onglet Clients (statutCRM, notesCRM,
  // updatedAt, updatedBy) ne sont jamais dans `fields` ci-dessus, donc un
  // updateMask qui ne liste qu'eux les laisse intacts à chaque synchro.
  const mask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  const url = `${FIRESTORE_BASE}/crm_clients/${item.id}?${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`Échec écriture Firestore ${item.id} (${res.status}): ${await res.text()}`);
  }
}

const googleToken = await getGoogleAccessToken();
const items = await fetchAllItems();
console.log(`${items.length} client(s) à synchroniser vers Firestore…`);

let failures = 0;
for (const item of items) {
  try {
    await upsertClient(googleToken, item);
  } catch (err) {
    failures += 1;
    console.error(`ÉCHEC pour l'item ${item.id}: ${err.message}`);
  }
}
console.log(`OK: ${items.length - failures}/${items.length} synchronisés.`);
if (failures > 0) process.exit(1);
