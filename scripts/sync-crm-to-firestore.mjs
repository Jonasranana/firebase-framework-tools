// Copie les leads du tableau Monday "Lead venant du site internet" vers la
// collection Firestore "crm_clients", pour l'onglet Clients de l'Espace
// Pro (client/src/pages/ClientsCRM.tsx). Le jeton Monday reste côté
// serveur ; la lecture côté client est protégée par les règles Firestore
// (auth Google + liste blanche d'e-mails, voir OutilDevis.tsx).
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
const BOARD_ID = "18420831671"; // "Lead venant du site internet"

const COL_IDS = [
  "color_mm51cvw8",
  "long_text_mm6tergg",
  "phone_mm51zq5n",
  "date_mm51nnzy",
  "text_mm51r5ff",
  "text_mm51p4ha",
  "numeric_mm515v32",
  "text_mm51r1ad",
  "text_mm51x68t",
  "text_mm51n2s9",
  "text_mm51e0cv",
  "text_mm51r815",
  "text_mm51k07s",
  "email_mm5178r7",
  "text_mm72vg5a",
  "text_mm77achg",
  "text_mm77txp",
  "text_mm77hatv",
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

async function fetchAllItems() {
  const query = `query ($board: ID!, $cols: [String!], $cursor: String) {
    boards(ids: [$board]) {
      items_page(limit: 100, cursor: $cursor) {
        cursor
        items {
          id
          name
          created_at
          group { title }
          column_values(ids: $cols) { id text }
        }
      }
    }
  }`;
  const items = [];
  let cursor = null;
  do {
    const data = await mondayQuery(query, { board: BOARD_ID, cols: COL_IDS, cursor });
    const page = data.boards[0].items_page;
    items.push(...page.items);
    cursor = page.cursor;
  } while (cursor);
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
  const phone = colText(item, "phone_mm51zq5n");
  const fields = {
    name: str(item.name),
    groupe: str(item.group?.title),
    statut: str(colText(item, "color_mm51cvw8")),
    commentaire: str(colText(item, "long_text_mm6tergg")),
    telephone: str(phone),
    telHref: str(telHref(phone)),
    recuLe: str(colText(item, "date_mm51nnzy")),
    email: str(colText(item, "email_mm5178r7")),
    projet: str(colText(item, "text_mm72vg5a")),
    source: str(colText(item, "text_mm51e0cv")),
    departement: str(colText(item, "text_mm51x68t")),
    typeLogement: str(colText(item, "text_mm51p4ha")),
    surface: str(colText(item, "numeric_mm515v32")),
    chauffage: str(colText(item, "text_mm51r1ad")),
    proprietaire: str(colText(item, "text_mm51r815")),
    foyer: str(colText(item, "text_mm51n2s9")),
    revenus: str(colText(item, "text_mm51r5ff")),
    echeance: str(colText(item, "text_mm51k07s")),
    contactPro: str(colText(item, "text_mm77achg")),
    typeSite: str(colText(item, "text_mm77txp")),
    nbVehicules: str(colText(item, "text_mm77hatv")),
    createdAt: str(item.created_at),
  };
  const url = `${FIRESTORE_BASE}/crm_clients/${item.id}`;
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
