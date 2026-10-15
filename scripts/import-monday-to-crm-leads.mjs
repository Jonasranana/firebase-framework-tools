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
// MODE=refresh : remet à jour les fiches DÉJÀ importées (statut, groupe, colonnes)
// sans toucher à leurs notes, et seulement si personne ne les a modifiées dans
// le CRM depuis l'import (updatedBy = « import Monday »).
const REFRESH = process.env.MODE === "refresh";
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
  zone: "color_mm7eccnx",
  mailAuto: "color_mm7ensy9",
  dernierMail: "date_mm7ed3c9",
  racMesure: "numeric_mm7er35c",
  email: "email_mm2qmb9n",
  cp: "text_mm2qf4s7",
  tranche: "text_mm6zss8",
  revenuFiscal: "numeric_mm2qa489",
  foyerCalc: "numeric_mm2q9m35",
  foyerSite: "text_mm747bpc",
  chauffageSite: "text_mm747sr4",
  chauffage: "dropdown_mm2qdqfm",
  surface: "numeric_mm2q4jsz",
  notesRapides: "text_mm2qhek4",
  resume: "long_text_mm6xz2sp",
  projet: "text_mm76rsb3",
  source: "text_mm76vm3v",
  typeDemande: "color_mm7m3q82",
  typeLead: "color_mm79bwsw",
  personnes: "multiple_person_mm3f2ah2",
  statutLed: "text_mm6vbefs",
  villeChantier: "text_mm6vvkpp",
  premierContact: "date_mm6vw6b2",
  appelsMois: "numeric_mm6zcp55",
  poseur: "color_mm79nd1k",
  dateVt: "date_mm7993h4",
  datePose: "date_mm79d6a9",
  montant: "numeric_mm7928z9",
  ressenti: "color_mm791txe",
};

// Colonnes « fields » du CRM (clé de colonne CRM → clé Monday ci-dessus), copiées
// telles quelles (texte Monday). Voir client/src/lib/crmColumns.ts.
const FIELD_COLUMNS = [
  "pipeline", "commercial", "precarite", "marque", "zone", "mailAuto", "dernierMail", "racMesure",
  "tranche", "revenuFiscal", "foyerCalc", "foyerSite", "chauffageSite", "chauffage", "surface",
  "notesRapides", "resume", "typeDemande", "personnes", "statutLed", "villeChantier",
  "premierContact", "appelsMois", "poseur", "dateVt", "datePose", "montant", "ressenti",
];

// Statut Appel Monday (libellé en minuscules) → clé du CRM (client/src/lib/crm.ts).
const STATUS_KEY = {
  "à appeler": "a_appeler",
  "rappel demandé": "rappel_demande",
  "intéressé": "interesse",
  "rdv pris": "rdv_pris",
  "vt faite par bets": "vt_faite_bets",
  "en cours chez bets": "en_cours_bets",
  "en cours": "en_cours",
  "attente docs": "attente_docs",
  "docs recu": "docs_recu",
  "a relancer": "a_relancer",
  "manque les revenu": "manque_revenu",
  "manque les info": "manque_info",
  nrp: "nrp",
  "nrp 2": "nrp2",
  "mauvais numéro": "mauvais_numero",
  "pas intéressé": "pas_interesse",
  "pas éligible revenu": "pas_eligible_revenu",
  "pas eligible a la pac": "pas_eligible_pac",
  "panneau solaire": "panneau_solaire",
  "proposition envoyer": "proposition_envoyee",
  "me rapelle": "me_rappelle",
  "instal prevu": "instal_prevu",
  "propal praimy a  faire": "propal_praimy",
  "🆕 nouveau lead": "nouveau_lead",
  "compliqué": "complique",
  "pas adapté": "pas_adapte",
  "propal recu": "propal_recu",
  "installer bets": "installer_bets",
  "pas bon": "pas_bon",
  "whattapp envoyé": "whatsapp_envoye",
  "attente revenus": "attente_revenus",
  "vt praimy": "vt_praimy",
  "a rap carole": "a_rap_carole",
};

// Groupe Monday → groupe du tableau CRM (identifiants de DEFAULT_LEAD_GROUPS
// dans client/src/lib/crm.ts). Groupe inconnu : « contacts ».
const GROUP_MAP = {
  "📥 nouveaux leads du site internet": "nouveaux",
  "0/ contacts": "contacts",
  "1/leads mebarek": "mebarek",
  "rdv pris par mebarek": "rdv_mebarek",
  "2/ docs demandés": "docs_demandes",
  "3/ docs reçues": "docs_recus",
  "4/ accord previsite": "previsite",
  "5/ date d'installation": "installation",
  nrp: "nrp",
  "pas eligibile": "pas_eligible",
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
  const status = STATUS_KEY[statutMonday.toLowerCase()] ?? "vide";
  const pipeline = t(C.pipeline);

  const typeLeadLabel = t(C.typeLead);
  const projet = t(C.projet);
  let type;
  if (/gonflage/i.test(typeLeadLabel) || /gonflage/i.test(projet)) type = "Gonflage";
  else if (/sms/i.test(typeLeadLabel)) type = "SMS";
  else if (/solaire/i.test(typeLeadLabel) || /solaire|panneau/i.test(projet) || /panneau solaire/i.test(statutMonday)) type = "Solaire";
  else if (/autre/i.test(typeLeadLabel)) type = "Autre";
  else type = "PAC";

  // Colonnes Monday reprises à l'identique (valeurs texte), sans les vides.
  const fields = {};
  for (const k of FIELD_COLUMNS) {
    const v = t(C[k]);
    if (v) fields[k] = v;
  }
  const details = { "Groupe Monday": item.group?.title, "Lien Monday": item.url };
  for (const k of Object.keys(details)) if (!details[k]) delete details[k];

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
      email: email.toLowerCase(),
      postalCode: t(C.cp),
      city: t(C.villeChantier),
      type,
      source: t(C.source) || "monday",
      projet,
      status,
      fields,
      group: GROUP_MAP[String(item.group?.title ?? "").trim().toLowerCase()] ?? "contacts",
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

const refreshable = new Set();
if (REFRESH) {
  const all = await db.collection("crm_leads").select("updatedBy").get();
  for (const d of all.docs) if (d.id.startsWith("monday_") && d.get("updatedBy") === "import Monday") refreshable.add(d.id);
  console.log(`${refreshable.size} fiches importées non modifiées, à rafraîchir.`);
}

for await (const item of fetchItems()) {
  stats.lus++;
  const lead = convert(item);
  if (REFRESH) {
    if (!refreshable.has(lead.id)) {
      stats.deja_la++;
      continue;
    }
    byStatus[lead.data.status] = (byStatus[lead.data.status] ?? 0) + 1;
    stats.importes++;
    if (!DRY_RUN) {
      const { notes, createdAt, ...rest } = lead.data;
      writer.update(db.doc(`crm_leads/${lead.id}`), { ...rest, updatedBy: "import Monday" }).catch((e) => {
        stats.erreurs++;
        console.error(`ÉCHEC ${lead.id}: ${e.message}`);
      });
    }
    continue;
  }
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

console.log(DRY_RUN ? "ESSAI À BLANC (rien d'écrit)" : REFRESH ? "RAFRAÎCHISSEMENT TERMINÉ" : "IMPORT TERMINÉ");
console.log(stats);
console.log("Répartition par étape CRM :", byStatus);
if (stats.erreurs > 0) process.exit(1);
