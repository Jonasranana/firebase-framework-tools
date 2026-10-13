// Import du tableau Monday « Recrutement sous-traitants PAC - IP5 » (~92
// artisans) dans le CRM maison (collection Firestore crm_artisans, onglet
// Artisans de /admin). Étape 5 du remplacement de Monday.
//
// Même principe que l'import des leads (import-monday-to-crm-leads.mjs) :
// identifiant "monday_<id>", jamais d'écrasement, relançable sans risque,
// artisans déjà présents (même e-mail, ex. grille reçue depuis le site)
// ignorés. DRY_RUN=1 : n'écrit rien, affiche seulement le bilan.

import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const BOARD_ID = "18435041484";
const DRY_RUN = process.env.DRY_RUN === "1";
const token = process.env.MONDAY_API_TOKEN;
if (!token) {
  console.error("MONDAY_API_TOKEN manquant");
  process.exit(1);
}
initializeApp();
const db = getFirestore();

const C = {
  zone: "text_mm8232wx",
  ville: "text_mm82ax38",
  tel: "text_mm825e9m",
  email: "email_mm82w6sr",
  siret: "text_mm82j894",
  relance: "date_mm82zjr3",
  rge: "boolean_mm82n4hn",
  notes: "long_text_mm82kxxs",
  statut: "color_mm82r5tz",
};

// Statut Monday → étape du CRM (clés de client/src/lib/crm.ts).
const STATUS_MAP = {
  "a contacter": "a_contacter",
  "mail 1 envoye": "mail1",
  "relance envoyee": "relance",
  "dernier message envoye": "dernier",
  "a rappeler": "a_rappeler",
  nrp: "nrp",
  potentiel: "potentiel",
  "grille remplie": "grille",
  signe: "signe",
  dead: "dead",
};
const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function monday(query, variables) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json", "API-Version": "2024-10" },
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && !body.errors?.length) return body.data;
    if (attempt >= 5) throw new Error(`API Monday: ${JSON.stringify(body)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const QUERY = `query ($board: ID!, $cols: [String!], $cursor: String) {
  boards(ids: [$board]) {
    items_page(limit: 50, cursor: $cursor) {
      cursor
      items {
        id name created_at url
        group { title }
        column_values(ids: $cols) { id text value }
        updates(limit: 25) { text_body body created_at creator { name } }
      }
    }
  }
}`;

async function* fetchItems() {
  let cursor = null;
  do {
    const data = await monday(QUERY, { board: BOARD_ID, cols: Object.values(C), cursor });
    const page = data.boards[0].items_page;
    yield* page.items;
    cursor = page.cursor;
  } while (cursor);
}

const uid = () => Math.random().toString(36).slice(2, 10);

function convert(item) {
  const col = Object.fromEntries(item.column_values.map((c) => [c.id, c]));
  const t = (id) => (col[id]?.text ?? "").trim();
  let email = "";
  try {
    email = (JSON.parse(col[C.email]?.value ?? "null")?.email ?? t(C.email)).trim();
  } catch {
    email = t(C.email);
  }
  email = email.toLowerCase();
  const statutMonday = t(C.statut);
  const status = STATUS_MAP[norm(statutMonday)] ?? "a_contacter";
  const now = new Date().toISOString();
  const notes = [];
  if (t(C.notes)) notes.push({ id: uid(), text: `Notes d'appel (Monday) : ${t(C.notes)}`, by: "import Monday", at: now, kind: "note" });
  for (const u of item.updates ?? []) {
    const text = String(u.text_body ?? u.body ?? "").trim();
    if (text) notes.push({ id: uid(), text: `[Monday] ${text}`, by: u.creator?.name || "import Monday", at: u.created_at, kind: "note" });
  }
  notes.push({
    id: uid(),
    text: `Importé depuis Monday (statut d'origine : ${statutMonday || "aucun"}, groupe : ${item.group?.title ?? ""})`,
    by: "import Monday",
    at: now,
    kind: "statut",
  });
  return {
    id: `monday_${item.id}`,
    email,
    data: {
      name: item.name.trim(),
      email,
      telephone: t(C.tel),
      siret: t(C.siret),
      ville: t(C.ville),
      zone: t(C.zone),
      status,
      relanceLe: t(C.relance),
      // Colonne case à cocher : le texte vaut "v" quand elle est cochée.
      rgeVerifie: t(C.rge).toLowerCase() === "v",
      notes,
      source: "monday",
      mondayItemId: String(item.id),
      mondayUrl: item.url,
      createdAt: Timestamp.fromDate(new Date(item.created_at)),
      updatedAt: Timestamp.now(),
      updatedBy: "import Monday",
    },
  };
}

const existingEmails = new Set();
for (const d of (await db.collection("crm_artisans").select("email").get()).docs) {
  if (d.get("email")) existingEmails.add(d.get("email"));
}

const stats = { lus: 0, importes: 0, deja_presents: 0, erreurs: 0 };
const byStatus = {};
const writer = db.bulkWriter();
writer.onWriteError((err) => (err.code === 6 ? false : err.failedAttempts < 5));

for await (const item of fetchItems()) {
  stats.lus++;
  const a = convert(item);
  if (a.email && existingEmails.has(a.email)) {
    stats.deja_presents++;
    continue;
  }
  byStatus[a.data.status] = (byStatus[a.data.status] ?? 0) + 1;
  if (DRY_RUN) {
    stats.importes++;
    continue;
  }
  writer
    .create(db.doc(`crm_artisans/${a.id}`), a.data)
    .then(() => stats.importes++)
    .catch((e) => {
      if (e.code === 6) stats.deja_presents++;
      else {
        stats.erreurs++;
        console.error(`ÉCHEC ${a.id}: ${e.message}`);
      }
    });
}
await writer.close();

console.log(DRY_RUN ? "ESSAI À BLANC (rien d'écrit)" : "IMPORT TERMINÉ");
console.log(stats);
console.log("Répartition par étape CRM :", byStatus);
if (stats.erreurs > 0) process.exit(1);
