// Synchronisation Monday → CRM, à sens unique, pendant la période où Monday
// est encore utilisé. Lancée automatiquement plusieurs fois par jour par
// .github/workflows/sync-monday-crm.yml.
//
// Ce qui est recopié :
//   1. ÉTIQUETTES (réglages des colonnes Monday) : liste, ordre, couleurs et
//      étiquettes désactivées de chaque colonne de statut. Pac Pac : réglages
//      des colonnes (crm_boards/leads_columns). Tableaux intégrés depuis les
//      Archives (crm_boards avec mondayBoardId) : colonnes (nouvelles colonnes,
//      titres, étiquettes) et groupes (titres, couleurs, ordre, nouveaux).
//      Appliqué quand les réglages ont changé dans Monday depuis le dernier
//      passage (empreinte gardée dans monday_sync_state/main).
//   2. LIGNES modifiées dans Monday depuis le dernier passage : Pac Pac
//      (fiches « monday_<id> » et leads du site reliés par
//      ip5_leads.mondayItemId) et tableaux intégrés (« m<tableau>_<ligne> ») :
//      nom, téléphone, e-mail, statut, groupe, rappel, colonnes. Nouvelles
//      lignes créées. Nouveaux commentaires ajoutés à l'historique.
//   3. RATTRAPAGE COMPLET, une seule fois par tableau (ou avec FULL=1) : toutes
//      les lignes sont comparées à Monday, seules les différences sont écrites
//      (pas de changement de « Dernière mise à jour » pour une ligne identique).
//      Pac Pac : les fiches déjà modifiées à la main dans le CRM (par une
//      personne) sont laissées telles quelles et comptées ; les lignes absentes
//      du CRM ne sont pas recréées. Tableaux intégrés : Monday fait foi, les
//      lignes absentes sont créées.
//
// Règle : Monday fait foi pour les colonnes qui viennent de Monday. Notes,
// documents, fichiers et colonnes propres au CRM ne sont jamais touchés. Rien
// n'est jamais supprimé, ni dans le CRM ni dans Monday (Monday est seulement lu).
//
// Variables : GOOGLE_APPLICATION_CREDENTIALS, MONDAY_API_TOKEN,
//   DRY_RUN=1 (n'écrit rien), SINCE=AAAA-MM-JJ (forcer le point de départ),
//   FULL=1 (refaire le rattrapage complet de tous les tableaux),
//   SCHEDULED=1 (lancement planifié : ne fait rien tant que la synchro n'a pas
//   été lancée une première fois à la main).

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");

const DRY_RUN = process.env.DRY_RUN === "1";
const FULL_ALL = process.env.FULL === "1";
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
const state = stateSnap.exists ? stateSnap.data() : {};
// Lancement planifié : seulement après un premier passage réel lancé à la main.
if (process.env.SCHEDULED === "1" && !stateSnap.exists) {
  console.log("Synchro pas encore activée (lancer une première fois à la main, sans essai à blanc).");
  process.exit(0);
}
const lastRun = process.env.SINCE
  ? new Date(`${process.env.SINCE}T00:00:00Z`)
  : state.lastRun
    ? new Date(new Date(state.lastRun).getTime() - 15 * 60 * 1000)
    : new Date(Date.now() - 3 * 24 * 3600 * 1000);
const sinceIso = lastRun.toISOString();
const fullDone = { ...(state.fullDone ?? {}) };
const labelHash = { ...(state.labelHash ?? {}) };
console.log(`Modifications Monday depuis ${sinceIso}${DRY_RUN ? " (ESSAI À BLANC)" : ""}${FULL_ALL ? " + rattrapage complet forcé" : ""}`);

// Lignes d'un tableau : seulement celles modifiées depuis sinceIso (filtre Monday au jour près,
// puis à la seconde ici), ou toutes (rattrapage complet).
async function* itemsOf(boardId, colIds, full) {
  const fields = `id name created_at updated_at url group { id title } parent_item { id } column_values(ids: $cols) { id type text value }`;
  const limit = full ? 25 : 50;
  const q = full
    ? `query ($board: ID!, $cols: [String!]) { boards(ids: [$board]) { items_page(limit: ${limit}) { cursor items { ${fields} } } } }`
    : `query ($board: ID!, $cols: [String!], $day: CompareValue!) {
        boards(ids: [$board]) {
          items_page(limit: ${limit}, query_params: { rules: [{ column_id: "__last_updated__", compare_value: $day, operator: greater_than_or_equals, compare_attribute: "UPDATED_AT" }] }) {
            cursor
            items { ${fields} }
          }
        }
      }`;
  const qNext = `query ($cursor: String!, $cols: [String!]) { next_items_page(limit: ${limit}, cursor: $cursor) { cursor items { ${fields} } } }`;
  const vars = full ? { board: String(boardId), cols: colIds } : { board: String(boardId), cols: colIds, day: ["EXACT", sinceIso.slice(0, 10)] };
  let page = (await monday(q, vars)).boards[0]?.items_page;
  while (page) {
    for (const it of page.items) if (full || it.updated_at >= sinceIso) yield it;
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

const stats = {
  etiquettes_maj: 0, pacpac_maj: 0, pacpac_crees: 0, pacpac_ignorees_crm: 0, pacpac_absentes_du_crm: 0,
  tableaux: 0, lignes_maj: 0, lignes_creees: 0, commentaires: 0, rattrapages: 0, erreurs: 0,
};
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
const hashOf = (x) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 16);

// ═══════════ Étiquettes (réglages des colonnes de statut) ═══════════
const FALLBACK = ["#fdab3d", "#00c875", "#df2f4a", "#007eb5", "#9d50dd", "#579bfc", "#ffcb00", "#037f4c", "#ff642e", "#7f8794"];
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "x";

// Étiquettes d'une colonne, dans l'ordre de Monday, avec leurs couleurs. Les étiquettes désactivées dans
// Monday sont gardées (les lignes qui les ont restent colorées) mais marquées « off » (plus proposées au choix).
function optionsOf(settingsStr, keyOf = (l) => l) {
  let st;
  try {
    st = JSON.parse(settingsStr || "{}");
  } catch {
    return [];
  }
  let list = [];
  if (Array.isArray(st.labels)) list = st.labels.map((l) => ({ id: String(l.id), label: String(l.name ?? l.label ?? "") }));
  else if (st.labels && typeof st.labels === "object") list = Object.entries(st.labels).map(([id, label]) => ({ id, label: String(label) }));
  const pos = st.labels_positions_v2 ?? st.labels_positions ?? {};
  const off = new Set((st.deactivated_labels ?? []).map(String));
  const colors = st.labels_colors ?? {};
  list = list.filter((l) => l.label).sort((a, b) => (pos[a.id] ?? 999) - (pos[b.id] ?? 999) || Number(a.id) - Number(b.id));
  const seen = new Set();
  const out = [];
  list.forEach((l, i) => {
    const key = keyOf(l.label);
    if (seen.has(key)) return;
    seen.add(key);
    const c = colors[l.id]?.color;
    out.push({ key, label: l.label, hex: typeof c === "string" && c.startsWith("#") ? c : FALLBACK[i % FALLBACK.length], ...(off.has(l.id) ? { off: true } : {}) });
  });
  return out;
}

// ═══════════ Pac Pac : correspondances (reprises de scripts/import-monday-to-crm-leads.mjs) ═══════════
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
  "vt praimy": "vt_praimy", "a rap carole": "a_rap_carole",
};
// Une étiquette de statut qui n'a pas de clé connue (ajoutée plus tard dans Monday) reçoit une clé calculée
// à partir de son nom : la même est utilisée pour la liste des étiquettes et pour les lignes.
const statusKeyOf = (label) => STATUS_KEY[String(label).toLowerCase()] ?? `s_${slug(label)}`;
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

// Colonnes de statut de Pac Pac dont la liste d'étiquettes suit Monday : clé de colonne CRM → colonne Monday.
const PACPAC_LABEL_COLS = {
  status: "statut", pipeline: "pipeline", commercial: "commercial", mailAuto: "mailAuto",
  typeDemande: "typeDemande", poseur: "poseur", ressenti: "ressenti",
};
// Étiquettes qui n'existent que dans le CRM (pas dans Monday) et doivent rester proposées.
const CRM_ONLY_OPTIONS = { commercial: [{ key: "Jonas", label: "Jonas", hex: "#00c875" }] };

async function refreshPacPacLabels() {
  const ids = Object.values(PACPAC_LABEL_COLS).map((k) => C[k]);
  const cols = (await monday(`query ($b: ID!, $ids: [String!]) { boards(ids: [$b]) { columns(ids: $ids) { id title settings_str } } }`, { b: PACPAC, ids })).boards[0]?.columns ?? [];
  const ref = db.doc("crm_boards/leads_columns");
  const cur = (await ref.get()).get("config") ?? {};
  const options = { ...(cur.options ?? {}) };
  let changed = 0;
  for (const [crmKey, mKey] of Object.entries(PACPAC_LABEL_COLS)) {
    const col = cols.find((c) => c.id === C[mKey]);
    if (!col) continue;
    const h = hashOf(col.settings_str);
    if (labelHash[`pacpac:${crmKey}`] === h) continue;
    const fromMonday = optionsOf(col.settings_str, crmKey === "status" ? statusKeyOf : (l) => l);
    const mondayKeys = new Set(fromMonday.map((o) => o.key));
    const mondayLabels = new Set(fromMonday.map((o) => o.label.toLowerCase()));
    // Étiquettes ajoutées dans le CRM seulement : gardées à la fin.
    const extra = [...(cur.options?.[crmKey] ?? []), ...(CRM_ONLY_OPTIONS[crmKey] ?? [])].filter(
      (o) => o.label && !mondayKeys.has(o.key) && !mondayLabels.has(o.label.toLowerCase()),
    );
    const merged = [...fromMonday, ...extra.filter((o, i, a) => a.findIndex((x) => x.key === o.key) === i)];
    if (JSON.stringify(merged) !== JSON.stringify(cur.options?.[crmKey])) {
      options[crmKey] = merged;
      changed++;
      console.log(`Étiquettes Pac Pac « ${col.title} » : ${fromMonday.length} étiquettes Monday${extra.length ? ` + ${extra.length} propre(s) au CRM` : ""}.`);
    }
    labelHash[`pacpac:${crmKey}`] = h;
  }
  if (changed) {
    stats.etiquettes_maj += changed;
    write(() => ref.set({ config: { options }, updatedAt: FieldValue.serverTimestamp(), updatedBy: BY }, { merge: true }));
  }
}

// ═══════════ Tableaux intégrés : colonnes et groupes (mêmes règles que client/src/lib/mondayIntegrate.ts) ═══════════
const normTxt = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const WIDTH = { status: 160, text: 180, longtext: 240, number: 110, date: 130 };
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
    else if (["status", "color", "dropdown"].includes(c.type)) out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "status", options: optionsOf(c.settings_str) });
    else if (["checkbox", "boolean"].includes(c.type))
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "status", options: [{ key: "Oui", label: "Oui", hex: "#00c875" }, { key: "Non", label: "Non", hex: "#df2f4a" }] });
    else if (["long_text", "long-text"].includes(c.type)) out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "longtext" });
    else if (["numbers", "numeric"].includes(c.type)) out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "number" });
    else if (c.type === "date") out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "date" });
    else out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "text" });
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

// Colonnes du tableau CRM mises en phase avec Monday : nouvelles colonnes ajoutées, titres et étiquettes
// à jour. Les colonnes propres au CRM (ajoutées à la main, fichiers) et l'ordre existant sont gardés.
function mergeColumnsConfig(existing, mapped) {
  const cfg = JSON.parse(JSON.stringify(existing ?? {}));
  cfg.custom = cfg.custom ?? [];
  cfg.titles = cfg.titles ?? { name: "Nom" };
  cfg.order = cfg.order ?? ["name", ...mapped.map((m) => m.key), "docs", "maj", "creation"];
  cfg.baseOnly = cfg.baseOnly ?? ["name", "rappel", "phone", "email", "docs", "maj", "creation"];
  const byKey = new Map(cfg.custom.map((c) => [c.key, c]));
  for (const m of mapped) {
    if (m.target !== "custom") {
      cfg.titles[m.key] = m.col.title;
      continue;
    }
    const entry = byKey.get(m.key);
    if (!entry) {
      cfg.custom.push({ key: m.key, title: m.col.title, type: m.type, width: WIDTH[m.type] ?? 150, custom: true, ...(m.type === "status" ? { options: m.options } : {}) });
      const at = cfg.order.findIndex((k) => ["docs", "maj", "creation"].includes(k));
      cfg.order.splice(at < 0 ? cfg.order.length : at, 0, m.key);
    } else {
      entry.title = m.col.title;
      if (m.type === "status" && entry.type === "status") entry.options = m.options;
    }
  }
  return cfg;
}

async function refreshBoardMeta(boardDoc, mondayId, meta, mapped) {
  const bid = boardDoc.id;
  // Colonnes
  const colRef = db.doc(`crm_boards/${bid}_columns`);
  const h = hashOf({ cols: meta.columns.map((c) => [c.id, c.title, c.type, c.archived, c.settings_str]), groups: meta.groups });
  const already = labelHash[`board:${mondayId}`] === h;
  if (!already) {
    const cur = (await colRef.get()).get("config");
    const next = mergeColumnsConfig(cur, mapped);
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      console.log(`Tableau « ${meta.name} » : colonnes et étiquettes mises à jour depuis Monday.`);
      stats.etiquettes_maj++;
      write(() => colRef.set({ config: next, updatedAt: FieldValue.serverTimestamp(), updatedBy: BY }, { merge: true }));
    }
    // Groupes : titres, couleurs et ordre de Monday ; les groupes propres au CRM restent à la fin.
    const curGroups = boardDoc.get("groups") ?? [];
    const mg = meta.groups
      .filter((g) => !g.archived)
      .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
      .map((g) => ({ ...(curGroups.find((x) => x.id === g.id) ?? {}), id: g.id, title: g.title, color: g.color && g.color.startsWith("#") ? g.color : "#579bfc" }));
    const groups = [...mg, ...curGroups.filter((g) => !mg.some((x) => x.id === g.id))];
    if (groups.length && JSON.stringify(groups) !== JSON.stringify(curGroups)) {
      console.log(`Tableau « ${meta.name} » : groupes mis à jour depuis Monday.`);
      write(() => boardDoc.ref.set({ groups, updatedAt: FieldValue.serverTimestamp(), updatedBy: BY }, { merge: true }));
      return { groups, hash: h };
    }
    return { groups: curGroups, hash: h };
  }
  return { groups: boardDoc.get("groups") ?? [], hash: h };
}

// ═══════════ Lignes du CRM déjà présentes ═══════════
const siteByMonday = new Map();
for (const d of (await db.collection("ip5_leads").select("mondayItemId").get()).docs) {
  const mid = d.get("mondayItemId");
  if (mid) siteByMonday.set(String(mid), d.id);
}
const crmDocs = new Map();
const sitePhoneDay = new Map();
for (const d of (await db.collection("crm_leads").select("phone", "email", "name", "createdAt", "updatedBy", "status", "group", "rappelLe", "postalCode", "city", "type", "source", "projet", "fields", "details").get()).docs) {
  crmDocs.set(d.id, d.data());
  if (/^monday_|^m\d+_/.test(d.id)) continue;
  const iso = d.get("createdAt")?.toDate?.().toISOString() ?? "";
  sitePhoneDay.set(`${digits(d.get("phone"))}|${iso.slice(0, 10)}`, d.id);
}

// Écrit seulement ce qui change (une ligne identique garde sa « Dernière mise à jour »).
function diffPatch(cur, base, fields) {
  const patch = {};
  for (const [k, v] of Object.entries(base)) if ((cur?.[k] ?? "") !== (v ?? "")) patch[k] = v;
  for (const [k, v] of Object.entries(fields)) if ((cur?.fields?.[k] ?? "") !== (v ?? "")) patch[`fields.${k}`] = v || FieldValue.delete();
  return patch;
}

const noteOf = (u) => ({ id: `mu${u.id}`, text: `[Monday] ${String(u.text ?? "").trim()}`.slice(0, 3000), by: u.by || "Monday", at: String(u.at ?? ""), kind: "note" });

// ═══════════ 1. Tableau Pac Pac ═══════════
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
      status: statutMonday ? statusKeyOf(statutMonday) : "vide",
      group: GROUP_MAP[String(item.group?.title ?? "").trim().toLowerCase()] ?? "contacts",
      rappelLe: t(C.rappel),
      mondayItemId: String(item.id),
    },
    fields,
  };
}

async function syncPacPac() {
  const full = FULL_ALL || !fullDone.pacpac;
  const updates = full ? new Map() : await newUpdates(PACPAC);
  const seen = new Set();
  const handle = (item) => {
    const { base, fields, created, statutMonday } = pacpacFields(item);
    const siteId = siteByMonday.get(String(item.id));
    let docId = crmDocs.has(`monday_${item.id}`) ? `monday_${item.id}` : siteId && crmDocs.has(siteId) ? siteId : null;
    if (!docId) docId = sitePhoneDay.get(`${digits(base.phone)}|${created.slice(0, 10)}`) ?? null;
    const notes = (updates.get(String(item.id)) ?? []).map(noteOf);
    stats.commentaires += notes.length;
    if (docId) {
      const cur = crmDocs.get(docId);
      // Rattrapage complet : une fiche modifiée à la main dans le CRM n'est pas écrasée.
      if (full && /@/.test(String(cur?.updatedBy ?? ""))) {
        stats.pacpac_ignorees_crm++;
        return;
      }
      const patch = diffPatch(cur, base, fields);
      if ((cur?.details?.["Groupe Monday"] ?? "") !== (item.group?.title ?? "")) patch["details.Groupe Monday"] = item.group?.title ?? "";
      if (notes.length) patch.notes = FieldValue.arrayUnion(...notes);
      if (!Object.keys(patch).length) return;
      patch.updatedAt = Timestamp.now();
      patch.updatedBy = BY;
      stats.pacpac_maj++;
      write(() => writer.update(db.doc(`crm_leads/${docId}`), patch));
    } else if (full) {
      stats.pacpac_absentes_du_crm++; // pas recréée : une fiche peut avoir été supprimée volontairement
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
  for await (const item of itemsOf(PACPAC, Object.values(C), full)) {
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
  if (full) {
    stats.rattrapages++;
    fullDone.pacpac = startedAt.toISOString();
  }
  console.log(`Pac Pac${full ? " (rattrapage complet)" : ""} : ${stats.pacpac_maj} fiches mises à jour, ${stats.pacpac_crees} créées${full ? `, ${stats.pacpac_ignorees_crm} laissées (modifiées à la main dans le CRM), ${stats.pacpac_absentes_du_crm} absentes du CRM` : ""}.`);
}

// ═══════════ 2. Tableaux intégrés depuis les Archives ═══════════
async function syncIntegratedBoards() {
  const integrated = (await db.collection("crm_boards").get()).docs.filter((d) => d.get("mondayBoardId") && String(d.get("mondayBoardId")) !== PACPAC);
  for (const bd of integrated) {
    const mondayId = String(bd.get("mondayBoardId"));
    const boardDocId = bd.id;
    const meta = (
      await monday(
        `query ($b: ID!) { boards(ids: [$b]) { name columns { id title type archived settings_str } groups { id title color position archived } } }`,
        { b: mondayId },
      )
    ).boards[0];
    if (!meta) continue;
    stats.tableaux++;
    const mapped = mapColumns(meta.columns);
    const { groups, hash } = await refreshBoardMeta(bd, mondayId, meta, mapped);
    labelHash[`board:${mondayId}`] = hash;
    const groupIds = new Set(groups.map((g) => g.id));
    const full = FULL_ALL || !fullDone[mondayId];
    const updates = full ? new Map() : await newUpdates(mondayId);
    const seen = new Set();
    let maj = 0, crees = 0;
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
      const cur = crmDocs.get(docId);
      if (cur) {
        const patch = diffPatch(cur, { ...core, group }, fields);
        if (notes.length) patch.notes = FieldValue.arrayUnion(...notes);
        if (!Object.keys(patch).length) return;
        patch.updatedAt = Timestamp.now();
        patch.updatedBy = BY;
        maj++;
        write(() => writer.update(db.doc(`crm_leads/${docId}`), patch));
      } else {
        crees++;
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
    for await (const item of itemsOf(mondayId, colIds, full)) {
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
    stats.lignes_maj += maj;
    stats.lignes_creees += crees;
    if (full) {
      stats.rattrapages++;
      fullDone[mondayId] = startedAt.toISOString();
    }
    console.log(`Tableau « ${meta.name} »${full ? " (rattrapage complet)" : ""} : ${maj} lignes mises à jour, ${crees} créées.`);
  }
}

await refreshPacPacLabels();
await syncPacPac();
await syncIntegratedBoards();

await writer.close();
if (!DRY_RUN && stats.erreurs === 0) await STATE.set({ lastRun: startedAt.toISOString(), fullDone, labelHash, stats, updatedAt: Timestamp.now() });
console.log(DRY_RUN ? "ESSAI À BLANC (rien d'écrit)" : "SYNCHRONISATION TERMINÉE");
console.log(stats);
if (stats.erreurs > 0) process.exit(1);
