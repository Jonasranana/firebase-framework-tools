// Synchronisation Monday → CRM, à sens unique, pendant la période où Monday
// est encore utilisé. Lancée automatiquement plusieurs fois par jour par
// .github/workflows/sync-monday-crm.yml.
//
// Ce qui est recopié (seulement les lignes modifiées dans Monday depuis le
// dernier passage) :
//   1. Tableau « Pac Pac😀 » → fiches du CRM « monday_<id> » et leads du site
//      (reliés par ip5_leads.mondayItemId) : nom, téléphone, e-mail, code
//      postal, ville, statut d'appel, groupe, date de rappel, colonnes.
//      Une ligne créée dans Monday et absente du CRM y est créée.
//   2. Tableaux intégrés depuis les Archives (crm_boards avec mondayBoardId) →
//      fiches « m<tableau>_<ligne> » : nom, téléphone, e-mail, rappel, groupe,
//      colonnes. Nouvelles lignes créées.
//   3. Nouveaux commentaires Monday (et leurs réponses) ajoutés à l'historique
//      de la fiche, sans doublon.
//
// Règle : Monday fait foi pour les colonnes qui viennent de Monday. Une fiche
// modifiée dans le CRM n'est écrasée que si la même ligne change ensuite dans
// Monday, et seulement pour ces colonnes (notes, documents, colonnes propres au
// CRM ne sont jamais touchés). Rien n'est jamais supprimé, ni dans le CRM ni
// dans Monday (Monday est seulement lu).
//
// Variables : GOOGLE_APPLICATION_CREDENTIALS, MONDAY_API_TOKEN,
//   DRY_RUN=1 (n'écrit rien), SINCE=AAAA-MM-JJ (forcer le point de départ),
//   SCHEDULED=1 (lancement planifié : ne fait rien tant que la synchro n'a pas
//   été lancée une première fois à la main).

import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");

const DRY_RUN = process.env.DRY_RUN === "1";
const token = process.env.MONDAY_API_TOKEN;
if (!token) {
  console.error("MONDAY_API_TOKEN manquant");
  process.exit(1);
}
initializeApp();
const db = getFirestore();
const STATE = db.doc("monday_sync_state/main");
const BY = "sync Monday";

async function monday(query, variables) {
  for (let attempt = 1; ; attempt++) {
    let body = {};
    let res;
    try {
      res = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json", "API-Version": "2024-10" },
        body: JSON.stringify({ query, variables }),
      });
      body = await res.json().catch(() => ({}));
    } catch (e) {
      body = { errors: [{ message: String(e) }] };
    }
    if (res?.ok && !body.errors?.length) return body.data;
    const text = JSON.stringify(body);
    if (attempt >= 6) throw new Error(`API Monday: ${text.slice(0, 500)}`);
    await new Promise((r) => setTimeout(r, (/budget|rate|429|limit/i.test(text) ? 20000 : 2000) * attempt));
  }
}

// ── Point de départ : dernier passage réussi, moins 15 min de marge ──
const startedAt = new Date();
const stateSnap = await STATE.get();
// Lancement planifié : seulement après un premier passage réel lancé à la main.
if (process.env.SCHEDULED === "1" && !stateSnap.exists) {
  console.log("Synchro pas encore activée (lancer une première fois à la main, sans essai à blanc).");
  process.exit(0);
}
const lastRun = process.env.SINCE
  ? new Date(`${process.env.SINCE}T00:00:00Z`)
  : stateSnap.exists && stateSnap.get("lastRun")
    ? new Date(new Date(stateSnap.get("lastRun")).getTime() - 15 * 60 * 1000)
    : new Date(Date.now() - 3 * 24 * 3600 * 1000);
const sinceIso = lastRun.toISOString();
console.log(`Modifications Monday depuis ${sinceIso}${DRY_RUN ? " (ESSAI À BLANC)" : ""}`);

// Lignes d'un tableau modifiées depuis sinceIso (filtre Monday au jour près,
// puis à la seconde ici).
async function* changedItems(boardId, colIds) {
  const day = sinceIso.slice(0, 10);
  const q = `query ($board: ID!, $cols: [String!], $cursor: String, $day: CompareValue!) {
    boards(ids: [$board]) {
      items_page(limit: 50, cursor: $cursor, query_params: { rules: [{ column_id: "__last_updated__", compare_value: $day, operator: greater_than_or_equals, compare_attribute: "UPDATED_AT" }] }) {
        cursor
        items { id name created_at updated_at url group { id title } parent_item { id } column_values(ids: $cols) { id type text value } }
      }
    }
  }`;
  const qNext = `query ($cursor: String!, $cols: [String!]) {
    next_items_page(limit: 50, cursor: $cursor) {
      cursor
      items { id name created_at updated_at url group { id title } parent_item { id } column_values(ids: $cols) { id type text value } }
    }
  }`;
  let page = (await monday(q, { board: String(boardId), cols: colIds, cursor: null, day: ["EXACT", day] })).boards[0]?.items_page;
  while (page) {
    for (const it of page.items) if (it.updated_at >= sinceIso) yield it;
    if (!page.cursor) break;
    page = (await monday(qNext, { cursor: page.cursor, cols: colIds })).next_items_page;
  }
}

// Commentaires (et réponses) d'un tableau créés depuis sinceIso, par ligne.
async function newUpdates(boardId) {
  const byItem = new Map();
  const add = (itemId, u) => {
    const list = byItem.get(String(itemId)) ?? [];
    list.push(u);
    byItem.set(String(itemId), list);
  };
  for (let page = 1; page <= 20; page++) {
    const d = await monday(
      `query ($b: ID!, $p: Int) { boards(ids: [$b]) { updates(limit: 100, page: $p) {
        id item_id created_at text_body creator { name } replies { id created_at text_body creator { name } } } } }`,
      { b: String(boardId), p: page },
    );
    const ups = d.boards[0]?.updates ?? [];
    let older = 0;
    for (const u of ups) {
      if (u.created_at >= sinceIso) add(u.item_id, { id: u.id, text: u.text_body, by: u.creator?.name, at: u.created_at });
      else older++;
      for (const r of u.replies ?? [])
        if (r.created_at >= sinceIso) add(u.item_id, { id: r.id, text: r.text_body, by: r.creator?.name, at: r.created_at });
    }
    if (ups.length < 100 || older === ups.length) break;
  }
  return byItem;
}

const stats = { pacpac_maj: 0, pacpac_crees: 0, tableaux: 0, lignes_maj: 0, lignes_creees: 0, commentaires: 0, erreurs: 0 };
const writer = db.bulkWriter();
writer.onWriteError((err) => {
  if (err.code === 6) return false;
  stats.erreurs++;
  console.error(`ÉCHEC ${err.documentRef.path}: ${err.message}`);
  return err.failedAttempts < 5;
});
const write = (fn) => {
  if (!DRY_RUN) fn();
};

// ═══════════ 1. Tableau Pac Pac ═══════════
// Correspondances reprises de scripts/import-monday-to-crm-leads.mjs (garder
// les deux identiques si on les modifie).
const PACPAC = "18410104402";
const C = {
  statut: "color_mm6vdhz4", rappel: "date_mm7mttz7", pipeline: "color_mm79vem7", commercial: "color_mm6ysxma",
  tel: "phone_mm2qnqr2", precarite: "color_mm7eq7pm", marque: "color_mm7enw6k", zone: "color_mm7eccnx",
  mailAuto: "color_mm7ensy9", dernierMail: "date_mm7ed3c9", racMesure: "numeric_mm7er35c", email: "email_mm2qmb9n",
  cp: "text_mm2qf4s7", tranche: "text_mm6zss8", revenuFiscal: "numeric_mm2qa489", foyerCalc: "numeric_mm2q9m35",
  foyerSite: "text_mm747bpc", chauffageSite: "text_mm747sr4", chauffage: "dropdown_mm2qdqfm", surface: "numeric_mm2q4jsz",
  notesRapides: "text_mm2qhek4", resume: "long_text_mm6xz2sp", projet: "text_mm76rsb3", source: "text_mm76vm3v",
  typeDemande: "color_mm7m3q82", typeLead: "color_mm79bwsw", personnes: "multiple_person_mm3f2ah2",
  statutLed: "text_mm6vbefs", villeChantier: "text_mm6vvkpp", premierContact: "date_mm6vw6b2",
  appelsMois: "numeric_mm6zcp55", poseur: "color_mm79nd1k", dateVt: "date_mm7993h4", datePose: "date_mm79d6a9",
  montant: "numeric_mm7928z9", ressenti: "color_mm791txe",
};
const FIELD_COLUMNS = [
  "pipeline", "commercial", "precarite", "marque", "zone", "mailAuto", "dernierMail", "racMesure",
  "tranche", "revenuFiscal", "foyerCalc", "foyerSite", "chauffageSite", "chauffage", "surface",
  "notesRapides", "resume", "typeDemande", "personnes", "statutLed", "villeChantier",
  "premierContact", "appelsMois", "poseur", "dateVt", "datePose", "montant", "ressenti",
];
const STATUS_KEY = {
  "à appeler": "a_appeler", "rappel demandé": "rappel_demande", "intéressé": "interesse", "rdv pris": "rdv_pris",
  "vt faite par bets": "vt_faite_bets", "en cours chez bets": "en_cours_bets", "en cours": "en_cours",
  "attente docs": "attente_docs", "docs recu": "docs_recu", "a relancer": "a_relancer",
  "manque les revenu": "manque_revenu", "manque les info": "manque_info", nrp: "nrp", "nrp 2": "nrp2",
  "mauvais numéro": "mauvais_numero", "pas intéressé": "pas_interesse", "pas éligible revenu": "pas_eligible_revenu",
  "pas eligible a la pac": "pas_eligible_pac", "panneau solaire": "panneau_solaire",
  "proposition envoyer": "proposition_envoyee", "me rapelle": "me_rappelle", "instal prevu": "instal_prevu",
  "propal praimy a  faire": "propal_praimy", "🆕 nouveau lead": "nouveau_lead", "compliqué": "complique",
  "pas adapté": "pas_adapte", "propal recu": "propal_recu", "installer bets": "installer_bets", "pas bon": "pas_bon",
  "whattapp envoyé": "whatsapp_envoye", "attente revenus": "attente_revenus",
};
const GROUP_MAP = {
  "📥 nouveaux leads du site internet": "nouveaux", "0/ contacts": "contacts", "1/leads mebarek": "mebarek",
  "rdv pris par mebarek": "rdv_mebarek", "2/ docs demandés": "docs_demandes", "3/ docs reçues": "docs_recus",
  "4/ accord previsite": "previsite", "5/ date d'installation": "installation", nrp: "nrp", "pas eligibile": "pas_eligible",
};
const digits = (p) => {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("33") && d.length === 11) d = "0" + d.slice(2);
  return d;
};

// Colonnes Monday d'une ligne Pac Pac → champs du CRM (mêmes règles que l'import).
function pacpacFields(item) {
  const col = Object.fromEntries(item.column_values.map((c) => [c.id, c]));
  const t = (id) => (col[id]?.text ?? "").trim();
  let email = "";
  try {
    email = (JSON.parse(col[C.email]?.value ?? "null")?.email ?? t(C.email)).trim();
  } catch {
    email = t(C.email);
  }
  const statutMonday = t(C.statut);
  const typeLeadLabel = t(C.typeLead);
  const projet = t(C.projet);
  let type;
  if (/gonflage/i.test(typeLeadLabel) || /gonflage/i.test(projet)) type = "Gonflage";
  else if (/sms/i.test(typeLeadLabel)) type = "SMS";
  else if (/solaire/i.test(typeLeadLabel) || /solaire|panneau/i.test(projet) || /panneau solaire/i.test(statutMonday)) type = "Solaire";
  else if (/autre/i.test(typeLeadLabel)) type = "Autre";
  else type = "PAC";
  const fields = {};
  for (const k of FIELD_COLUMNS) fields[k] = t(C[k]);
  return {
    statutMonday,
    created: t(C.premierContact) ? `${t(C.premierContact)}T12:00:00Z` : item.created_at,
    base: {
      name: item.name.trim(),
      phone: t(C.tel),
      email: email.toLowerCase(),
      postalCode: t(C.cp),
      city: t(C.villeChantier),
      type,
      source: t(C.source) || "monday",
      projet,
      status: STATUS_KEY[statutMonday.toLowerCase()] ?? "vide",
      group: GROUP_MAP[String(item.group?.title ?? "").trim().toLowerCase()] ?? "contacts",
      rappelLe: t(C.rappel),
      mondayItemId: String(item.id),
    },
    fields,
  };
}

const noteOf = (u) => ({ id: `mu${u.id}`, text: `[Monday] ${String(u.text ?? "").trim()}`.slice(0, 3000), by: u.by || "Monday", at: String(u.at ?? ""), kind: "note" });

// Leads du site déjà dans le CRM : id Monday → id CRM, et téléphone|jour.
const siteByMonday = new Map();
for (const d of (await db.collection("ip5_leads").select("mondayItemId").get()).docs) {
  const mid = d.get("mondayItemId");
  if (mid) siteByMonday.set(String(mid), d.id);
}
const crmIds = new Set();
const sitePhoneDay = new Map();
for (const d of (await db.collection("crm_leads").select("phone", "createdAt").get()).docs) {
  crmIds.add(d.id);
  if (/^monday_|^m\d+_/.test(d.id)) continue;
  const iso = d.get("createdAt")?.toDate?.().toISOString() ?? "";
  sitePhoneDay.set(`${digits(d.get("phone"))}|${iso.slice(0, 10)}`, d.id);
}

{
  const updates = await newUpdates(PACPAC);
  const seen = new Set();
  const handle = (item) => {
    const { base, fields, created, statutMonday } = pacpacFields(item);
    const siteId = siteByMonday.get(String(item.id));
    let docId = crmIds.has(`monday_${item.id}`) ? `monday_${item.id}` : siteId && crmIds.has(siteId) ? siteId : null;
    if (!docId) docId = sitePhoneDay.get(`${digits(base.phone)}|${created.slice(0, 10)}`) ?? null;
    const notes = (updates.get(String(item.id)) ?? []).map(noteOf);
    stats.commentaires += notes.length;
    if (docId) {
      const patch = { ...base, updatedAt: Timestamp.now(), updatedBy: BY, "details.Groupe Monday": item.group?.title ?? "" };
      for (const [k, v] of Object.entries(fields)) patch[`fields.${k}`] = v || FieldValue.delete();
      if (notes.length) patch.notes = FieldValue.arrayUnion(...notes);
      stats.pacpac_maj++;
      write(() => writer.update(db.doc(`crm_leads/${docId}`), patch));
    } else {
      const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v));
      stats.pacpac_crees++;
      write(() =>
        writer.create(db.doc(`crm_leads/monday_${item.id}`), {
          ...base,
          fields: clean,
          details: { "Groupe Monday": item.group?.title ?? "", "Lien Monday": item.url ?? "" },
          notes: [...notes, { id: `ms${item.id}`, text: `Créé depuis Monday (statut d'origine : ${statutMonday || "aucun"})`, by: BY, at: startedAt.toISOString(), kind: "statut" }],
          createdAt: Timestamp.fromDate(new Date(created)),
          updatedAt: Timestamp.now(),
          updatedBy: BY,
        }),
      );
    }
  };
  for await (const item of changedItems(PACPAC, Object.values(C))) {
    if (item.parent_item) continue;
    seen.add(String(item.id));
    handle(item);
  }
  // Ligne seulement commentée (date de modification parfois inchangée).
  const rest = [...updates.keys()].filter((id) => !seen.has(id));
  for (let i = 0; i < rest.length; i += 50) {
    const d = await monday(
      `query ($ids: [ID!], $cols: [String!]) { items(ids: $ids) { id name created_at updated_at url group { id title } parent_item { id } column_values(ids: $cols) { id type text value } } }`,
      { ids: rest.slice(i, i + 50), cols: Object.values(C) },
    );
    for (const item of d.items ?? []) if (!item.parent_item) handle(item);
  }
  console.log(`Pac Pac : ${stats.pacpac_maj} fiches mises à jour, ${stats.pacpac_crees} créées.`);
}

// ═══════════ 2. Tableaux intégrés depuis les Archives ═══════════
// Mêmes règles que client/src/lib/mondayIntegrate.ts (mapColumns / valueOf).
const normTxt = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function mapColumns(columns) {
  const out = [];
  let phone = false, email = false, rappel = false;
  for (const c of columns.filter((x) => x.type !== "name" && !x.archived)) {
    const t = normTxt(c.title);
    if (["file", "subtasks", "button"].includes(c.type)) continue;
    if (!email && c.type === "email") (email = true), out.push({ key: "email", col: c, target: "core-email" });
    else if (!phone && (c.type === "phone" || (c.type === "text" && /(telephone|phone|mobile|portable|tel\b)/.test(t))))
      (phone = true), out.push({ key: "phone", col: c, target: "core-phone" });
    else if (!rappel && c.type === "date" && /(relance|rappel)/.test(t)) (rappel = true), out.push({ key: "rappel", col: c, target: "core-rappel" });
    else {
      const type = ["status", "color", "dropdown", "checkbox", "boolean"].includes(c.type) ? "status"
        : ["numbers", "numeric"].includes(c.type) ? "number" : c.type === "date" ? "date" : "text";
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type });
    }
  }
  return out;
}
function valueOf(m, cv) {
  if (!cv) return "";
  if (m.col.type === "checkbox" || m.col.type === "boolean") {
    try {
      const ch = JSON.parse(cv.value || "{}").checked;
      return ch === true || ch === "true" ? "Oui" : "";
    } catch {
      return "";
    }
  }
  const txt = String(cv.text ?? "").trim();
  if (m.type === "date" || m.target === "core-rappel") return txt.slice(0, 10);
  if (m.type === "number") return txt.replace(/\s/g, "").replace(",", ".");
  return txt;
}

const integrated = (await db.collection("crm_boards").get()).docs.filter((d) => d.get("mondayBoardId"));
for (const bd of integrated) {
  const mondayId = String(bd.get("mondayBoardId"));
  if (mondayId === PACPAC) continue;
  const boardDocId = bd.id;
  const groups = bd.get("groups") ?? [];
  const groupIds = new Set(groups.map((g) => g.id));
  const meta = (await monday(`query ($b: ID!) { boards(ids: [$b]) { name columns { id title type archived } } }`, { b: mondayId })).boards[0];
  if (!meta) continue;
  stats.tableaux++;
  const mapped = mapColumns(meta.columns);
  const updates = await newUpdates(mondayId);
  const seen = new Set();
  const handle = (item) => {
    const byId = Object.fromEntries(item.column_values.map((c) => [c.id, c]));
    const docId = `m${mondayId}_${item.id}`;
    const core = { name: item.name, phone: "", email: "", rappelLe: "" };
    const fields = {};
    for (const mc of mapped) {
      const v = valueOf(mc, byId[mc.col.id]);
      if (mc.target === "core-phone") core.phone = v;
      else if (mc.target === "core-email") core.email = v.toLowerCase();
      else if (mc.target === "core-rappel") core.rappelLe = v;
      else fields[mc.key] = v;
    }
    const group = groupIds.has(item.group?.id) ? item.group.id : groups[0]?.id ?? "nouveaux";
    const notes = (updates.get(String(item.id)) ?? []).map((u) => ({ id: String(u.id).slice(-10), text: String(u.text ?? "").slice(0, 3000), by: u.by || "Monday", at: String(u.at ?? ""), kind: "note" }));
    stats.commentaires += notes.length;
    if (crmIds.has(docId)) {
      const patch = { ...core, group, updatedAt: Timestamp.now(), updatedBy: BY };
      for (const [k, v] of Object.entries(fields)) patch[`fields.${k}`] = v || FieldValue.delete();
      if (notes.length) patch.notes = FieldValue.arrayUnion(...notes);
      stats.lignes_maj++;
      write(() => writer.update(db.doc(`crm_leads/${docId}`), patch));
    } else {
      stats.lignes_creees++;
      write(() =>
        writer.create(db.doc(`crm_leads/${docId}`), {
          ...core, postalCode: "", city: "", type: "Autre", source: `Monday : ${meta.name}`.slice(0, 80), projet: "",
          status: "nouveau_lead", group, board: boardDocId,
          fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v)),
          details: {}, notes, docCount: 0, docCats: [],
          createdAt: Timestamp.fromDate(new Date(item.created_at)), updatedAt: Timestamp.now(), updatedBy: BY,
        }),
      );
    }
  };
  const colIds = mapped.map((m) => m.col.id);
  for await (const item of changedItems(mondayId, colIds)) {
    if (item.parent_item) continue;
    seen.add(String(item.id));
    handle(item);
  }
  const rest = [...updates.keys()].filter((id) => !seen.has(id));
  for (let i = 0; i < rest.length; i += 50) {
    const d = await monday(
      `query ($ids: [ID!], $cols: [String!]) { items(ids: $ids) { id name created_at updated_at url group { id title } parent_item { id } column_values(ids: $cols) { id type text value } } }`,
      { ids: rest.slice(i, i + 50), cols: colIds },
    );
    for (const item of d.items ?? []) if (!item.parent_item) handle(item);
  }
  console.log(`Tableau « ${meta.name} » : ${seen.size + rest.length} lignes traitées.`);
}

await writer.close();
if (!DRY_RUN && stats.erreurs === 0) await STATE.set({ lastRun: startedAt.toISOString(), stats, updatedAt: Timestamp.now() });
console.log(DRY_RUN ? "ESSAI À BLANC (rien d'écrit)" : "SYNCHRONISATION TERMINÉE");
console.log(stats);
if (stats.erreurs > 0) process.exit(1);
