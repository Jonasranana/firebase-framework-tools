// Import des fiches du tableau Monday "Pac Pac😀" (~2 500) dans le CRM maison
// (collection Firestore crm_leads, onglet Leads de /admin). Étape 4 du
// remplacement de Monday.
//
// - Idempotent : chaque fiche a l'identifiant "monday_<id Monday>" et n'est
//   JAMAIS écrasée si elle existe déjà (les notes/statuts saisis dans le CRM
//   sont préservés). On peut donc relancer le script sans risque.
// - Anti-doublon : les leads du site déjà copiés par la fonction copyLeadToCrm
//   (identifiant non "monday_…") sont reconnus par téléphone + jour de
//   réception et ne sont pas réimportés.
// - Rien n'est perdu : le statut Monday d'origine, le groupe, le lien vers la
//   fiche Monday et les autres colonnes utiles vont dans "details".
//   Les fichiers de la colonne Documents ne sont PAS copiés (ils restent
//   consultables via le lien Monday).
//
// Variables d'environnement :
//   GOOGLE_APPLICATION_CREDENTIALS  JSON du compte de service Firebase
//   MONDAY_API_TOKEN                jeton API Monday
//   DRY_RUN=1                       n'écrit rien, affiche seulement le bilan

import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const BOARD_ID = "18410104402";
const DRY_RUN = process.env.DRY_RUN === "1";
const token = process.env.MONDAY_API_TOKEN;
if (!token) {
  console.error("MONDAY_API_TOKEN manquant");
  process.exit(1);
}

initializeApp();
const db = getFirestore();

const C = {
  statut: "color_mm6vdhz4",
  rappel: "date_mm7mttz7",
  pipeline: "color_mm79vem7",
  commercial: "color_mm6ysxma",
  tel: "phone_mm2qnqr2",
  precarite: "color_mm7eq7pm",
  marque: "color_mm7enw6k",
  email: "email_mm2qmb9n",
  cp: "text_mm2qf4s7",
  tranche: "text_mm6zss8",
  foyer: "text_mm747bpc",
  chauffageSite: "text_mm747sr4",
  chauffage: "dropdown_mm2qdqfm",
  surface: "numeric_mm2q4jsz",
  notesRapides: "text_mm2qhek4",
  resume: "long_text_mm6xz2sp",
  projet: "text_mm76rsb3",
  source: "text_mm76vm3v",
  typeDemande: "color_mm7m3q82",
  typeLead: "color_mm79bwsw",
  poseur: "color_mm79nd1k",
  dateVt: "date_mm7993h4",
  datePose: "date_mm79d6a9",
  montant: "numeric_mm7928z9",
  ville: "text_mm6vvkpp",
  premierContact: "date_mm6vw6b2",
  ressenti: "color_mm791txe",
};

// Statut Appel Monday → étape du CRM (clés de client/src/lib/crm.ts).
const STATUS_MAP = {
  "": "nouveau",
  "🆕 nouveau lead": "nouveau",
  "à appeler": "a_rappeler",
  "rappel demandé": "a_rappeler",
  "a relancer": "a_rappeler",
  "me rapelle": "a_rappeler",
  "panneau solaire": "a_rappeler",
  nrp: "injoignable",
  "nrp 2": "injoignable",
  "intéressé": "interesse",
  "manque les revenu": "interesse",
  "manque les info": "interesse",
  "attente revenus": "interesse",
  "whattapp envoyé": "interesse",
  "compliqué": "interesse",
  "en cours": "interesse",
  "proposition envoyer": "interesse",
  "propal praimy a  faire": "interesse",
  "propal recu": "interesse",
  "rdv pris": "rdv",
  "docs recu": "dossier",
  "attente docs": "dossier",
  "en cours chez bets": "dossier",
  "vt faite par bets": "dossier",
  "installer bets": "dossier",
  "instal prevu": "dossier",
  "pas intéressé": "perdu",
  "mauvais numéro": "perdu",
  "pas éligible revenu": "perdu",
  "pas eligible a la pac": "perdu",
  "pas adapté": "perdu",
  "pas bon": "perdu",
};

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
        updates(limit: 25) { body text_body created_at creator { name } }
      }
    }
  }
}`;

async function* fetchItems() {
  const cols = Object.values(C);
  let cursor = null;
  do {
    const data = await monday(QUERY, { board: BOARD_ID, cols, cursor });
    const page = data.boards[0].items_page;
    yield* page.items;
    cursor = page.cursor;
  } while (cursor);
}

const digits = (p) => {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("33") && d.length === 11) d = "0" + d.slice(2);
  return d;
};
const dayOf = (iso) => String(iso ?? "").slice(0, 10);
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

  const statutMonday = t(C.statut);
  let status = STATUS_MAP[statutMonday.toLowerCase()] ?? "interesse";
  const pipeline = t(C.pipeline);
  if (pipeline === "Installé") status = "gagne";
  else if (pipeline === "Pas bon") status = "perdu";
  else if (pipeline && !["perdu", "gagne"].includes(status)) status = "dossier";

  const typeLeadLabel = t(C.typeLead);
  const projet = t(C.projet);
  let type;
  if (/gonflage/i.test(typeLeadLabel) || /gonflage/i.test(projet)) type = "Gonflage";
  else if (/solaire/i.test(typeLeadLabel) || /solaire|panneau/i.test(projet) || /panneau solaire/i.test(statutMonday)) type = "Solaire";
  else if (/autre/i.test(typeLeadLabel)) type = "Autre";
  else type = "PAC";

  const raw = {
    "Statut Monday": statutMonday,
    "Groupe Monday": item.group?.title,
    "Étape dossier": pipeline,
    Commercial: t(C.commercial),
    Poseur: t(C.poseur),
    Revenus: t(C.tranche),
    "Précarité Prémi": t(C.precarite),
    Marque: t(C.marque),
    Foyer: t(C.foyer),
    Chauffage: t(C.chauffageSite) || t(C.chauffage),
    Surface: t(C.surface) ? `${t(C.surface)} m²` : "",
    "Type de demande": t(C.typeDemande),
    Ressenti: t(C.ressenti),
    "Date VT": t(C.dateVt),
    "Date pose": t(C.datePose),
    Montant: t(C.montant) ? `${t(C.montant)} €` : "",
    "Lien Monday": item.url,
  };
  const details = Object.fromEntries(Object.entries(raw).filter(([, v]) => v));

  const importedAt = new Date().toISOString();
  const notes = [];
  const note = (text, by, at) => text && notes.push({ id: uid(), text, by, at, kind: "note" });
  note(t(C.notesRapides) && `Notes rapides (Monday) : ${t(C.notesRapides)}`, "import Monday", importedAt);
  note(t(C.resume) && `Résumé d'appel (Monday) : ${t(C.resume)}`, "import Monday", importedAt);
  for (const u of item.updates ?? []) {
    const text = String(u.text_body ?? u.body ?? "").trim();
    note(text && `[Monday] ${text}`, u.creator?.name || "import Monday", u.created_at);
  }
  notes.push({
    id: uid(),
    text: `Importé depuis Monday (statut d'origine : ${statutMonday || "aucun"})`,
    by: "import Monday",
    at: importedAt,
    kind: "statut",
  });

  const created = t(C.premierContact) ? `${t(C.premierContact)}T12:00:00Z` : item.created_at;
  return {
    id: `monday_${item.id}`,
    day: dayOf(created),
    phoneDigits: digits(t(C.tel)),
    data: {
      name: item.name.trim(),
      phone: t(C.tel),
      email,
      postalCode: t(C.cp),
      city: t(C.ville),
      type,
      source: t(C.source) || "monday",
      projet,
      status,
      rappelLe: t(C.rappel),
      details,
      notes,
      mondayItemId: String(item.id),
      createdAt: Timestamp.fromDate(new Date(created)),
      updatedAt: Timestamp.now(),
      updatedBy: "import Monday",
    },
  };
}

// Leads du site déjà présents dans le CRM (copiés par copyLeadToCrm).
const existing = new Set();
const snap = await db.collection("crm_leads").select("phone", "createdAt").get();
for (const d of snap.docs) {
  if (d.id.startsWith("monday_")) continue;
  const iso = d.get("createdAt")?.toDate?.().toISOString();
  existing.add(`${digits(d.get("phone"))}|${dayOf(iso)}`);
}

const stats = { lus: 0, importes: 0, doublons_site: 0, deja_la: 0, erreurs: 0 };
const byStatus = {};
const writer = db.bulkWriter();
writer.onWriteError((err) => {
  if (err.code === 6) return false; // ALREADY_EXISTS : on ne touche pas
  return err.failedAttempts < 5;
});

for await (const item of fetchItems()) {
  stats.lus++;
  const lead = convert(item);
  if (lead.phoneDigits && existing.has(`${lead.phoneDigits}|${lead.day}`)) {
    stats.doublons_site++;
    continue;
  }
  byStatus[lead.data.status] = (byStatus[lead.data.status] ?? 0) + 1;
  if (DRY_RUN) {
    stats.importes++;
    continue;
  }
  writer
    .create(db.doc(`crm_leads/${lead.id}`), lead.data)
    .then(() => stats.importes++)
    .catch((e) => {
      if (e.code === 6) stats.deja_la++;
      else {
        stats.erreurs++;
        console.error(`ÉCHEC ${lead.id}: ${e.message}`);
      }
    });
  if (stats.lus % 250 === 0) console.log(`… ${stats.lus} fiches lues`);
}
await writer.close();

console.log(DRY_RUN ? "ESSAI À BLANC (rien d'écrit)" : "IMPORT TERMINÉ");
console.log(stats);
console.log("Répartition par étape CRM :", byStatus);
if (stats.erreurs > 0) process.exit(1);
