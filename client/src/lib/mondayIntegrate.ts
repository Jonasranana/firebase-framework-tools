import { crmFirestore } from "@/lib/crmDb";
import type { ColumnsConfig, LeadColumn } from "@/lib/crmColumns";
import type { FileRef, LeadGroup, LeadNote, Opt } from "@/lib/crm";
import type { SideConfig, SideItem } from "@/lib/crmSidebar";

// ─────────────────────────────────────────────────────────────────────────
// Intègre un tableau de l'archive Monday dans le CRM (« Tableau IP5 ») :
// même colonnes, mêmes étiquettes colorées, mêmes groupes, mêmes lignes, et
// les commentaires deviennent l'historique du chat de chaque ligne.
// L'archive n'est jamais modifiée. Identifiants stables : relancer l'intégration
// met à jour les mêmes lignes sans jamais créer de doublon.
// ─────────────────────────────────────────────────────────────────────────
type MCol = { id: string; title: string; type: string; settings_str?: string; archived?: boolean };
type MGroup = { id: string; title: string; color?: string; archived?: boolean; position?: string };
export type MBoardLite = { id: string; name: string; columns: MCol[]; groups: MGroup[] };
type MFileDoc = { id: string; name: string; url?: string; size?: number; ext?: string; path?: string; col?: string };
type MItemDoc = { itemId: string; name: string; groupId: string; createdAt: string; parentItemId?: string; cols: Record<string, { type: string; t?: string; d?: string; v?: string }>; files?: MFileDoc[] };
export const OTHER_FILES_KEY = "m_autres_fichiers";

export const boardIdFor = (mondayId: string) => `board_m${mondayId}`;

// Couleurs d'étiquettes Monday (si la couleur n'est pas déjà en hexadécimal).
const FALLBACK = ["#fdab3d", "#00c875", "#df2f4a", "#007eb5", "#9d50dd", "#579bfc", "#ffcb00", "#037f4c", "#ff642e", "#7f8794"];

// Étiquettes d'une colonne dans l'ordre de Monday, avec leurs couleurs ; les étiquettes désactivées
// dans Monday restent affichées sur les lignes qui les ont mais ne sont plus proposées au choix.
// (Même règle que scripts/sync-monday-to-crm.mjs, qui garde ces réglages à jour ensuite.)
function labelsOf(col: MCol): Opt[] {
  try {
    const st = JSON.parse(col.settings_str || "{}");
    let names: { id: string; label: string }[] = [];
    if (Array.isArray(st.labels)) names = st.labels.map((l: any) => ({ id: String(l.id), label: String(l.name ?? l.label ?? "") }));
    else if (st.labels && typeof st.labels === "object") names = Object.entries(st.labels).map(([id, v]) => ({ id, label: String(v) }));
    const colors = st.labels_colors ?? {};
    const pos = st.labels_positions_v2 ?? st.labels_positions ?? {};
    const off = new Set((st.deactivated_labels ?? []).map(String));
    const seen = new Set<string>();
    return names
      .filter((n) => n.label)
      .sort((a, b) => (pos[a.id] ?? 999) - (pos[b.id] ?? 999) || Number(a.id) - Number(b.id))
      .filter((n) => (seen.has(n.label) ? false : (seen.add(n.label), true)))
      .map((n, i) => {
        const c = colors[n.id]?.color;
        return { key: n.label, label: n.label, hex: typeof c === "string" && c.startsWith("#") ? c : FALLBACK[i % FALLBACK.length], ...(off.has(n.id) ? { off: true } : {}) };
      });
  } catch {
    return [];
  }
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Mapped = { key: string; col: MCol; target: "core-phone" | "core-email" | "core-rappel" | "custom"; type?: LeadColumn["type"]; options?: Opt[] };

export function mapColumns(board: MBoardLite): Mapped[] {
  const cols = board.columns.filter((c) => c.type !== "name" && !c.archived);
  let phone = false;
  let email = false;
  let rappel = false;
  const out: Mapped[] = [];
  for (const c of cols) {
    const t = norm(c.title);
    if (c.type === "subtasks" || c.type === "button") continue;
    if (c.type === "file") {
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "filecol" });
      continue;
    }
    if (!email && c.type === "email") {
      email = true;
      out.push({ key: "email", col: c, target: "core-email" });
    } else if (!phone && (c.type === "phone" || (c.type === "text" && /(telephone|phone|mobile|portable|tel\b)/.test(t)))) {
      phone = true;
      out.push({ key: "phone", col: c, target: "core-phone" });
    } else if (!rappel && c.type === "date" && /(relance|rappel)/.test(t)) {
      rappel = true;
      out.push({ key: "rappel", col: c, target: "core-rappel" });
    } else if (c.type === "status" || c.type === "color") {
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "status", options: labelsOf(c) });
    } else if (c.type === "dropdown") {
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "status", options: labelsOf(c) });
    } else if (c.type === "checkbox" || c.type === "boolean") {
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "status", options: [{ key: "Oui", label: "Oui", hex: "#00c875" }, { key: "Non", label: "Non", hex: "#df2f4a" }] });
    } else if (c.type === "long_text" || c.type === "long-text") {
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "longtext" });
    } else if (c.type === "numbers" || c.type === "numeric") {
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "number" });
    } else if (c.type === "date") {
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "date" });
    } else {
      out.push({ key: `m_${c.id}`, col: c, target: "custom", type: "text" });
    }
  }
  return out;
}

const WIDTH: Record<string, number> = { status: 160, text: 180, longtext: 240, number: 110, date: 130, filecol: 130 };

function valueOf(m: Mapped, item: MItemDoc): string {
  if (m.type === "filecol") return "";
  const c = item.cols[m.col.id];
  if (!c) return "";
  if (m.col.type === "checkbox" || m.col.type === "boolean") {
    try {
      return JSON.parse(c.v || "{}").checked === "true" || JSON.parse(c.v || "{}").checked === true ? "Oui" : "";
    } catch {
      return c.t === "v" ? "Oui" : "";
    }
  }
  const txt = (c.t || c.d || "").trim();
  if (m.type === "date" || m.target === "core-rappel") return txt.slice(0, 10);
  if (m.type === "number") return txt.replace(/\s/g, "").replace(",", ".");
  return txt;
}

export function buildColumnsConfig(board: MBoardLite, mapped: Mapped[], withOtherFiles = false): ColumnsConfig {
  const custom: LeadColumn[] = mapped
    .filter((m) => m.target === "custom")
    .map((m) => ({
      key: m.key,
      title: m.col.title,
      type: m.type!,
      width: WIDTH[m.type!] ?? 150,
      custom: true,
      options: m.type === "status" ? m.options : undefined,
    }));
  if (withOtherFiles) custom.push({ key: OTHER_FILES_KEY, title: "Autres fichiers", type: "filecol", width: 130, custom: true });
  const titles: Record<string, string> = {};
  for (const m of mapped) if (m.target.startsWith("core-")) titles[m.key] = m.col.title;
  return {
    baseOnly: ["name", "rappel", "phone", "email", "docs", "maj", "creation"],
    custom,
    titles: { name: "Nom", ...titles },
    order: ["name", ...mapped.map((m) => m.key), ...(withOtherFiles ? [OTHER_FILES_KEY] : []), "docs", "maj", "creation"],
  };
}

export type IntegrateProgress = (msg: string) => void;

export async function integrateMondayBoard(
  board: MBoardLite,
  email: string,
  sidebar: { config: SideConfig; save: (c: SideConfig) => Promise<void> },
  progress: IntegrateProgress,
): Promise<{ boardId: string; items: number }> {
  const { m, db } = await crmFirestore();
  const boardId = boardIdFor(board.id);
  const mapped = mapColumns(board);

  progress("Lecture des lignes de l'archive…");
  const items: MItemDoc[] = [];
  let last: any = null;
  for (;;) {
    const cons: any[] = [m.where("boardId", "==", board.id)];
    if (last) cons.push(m.startAfter(last));
    cons.push(m.limit(500));
    const snap = await (m.getDocs as any)((m.query as any)(m.collection(db, "monday_items"), ...cons));
    for (const d of snap.docs) {
      const x = d.data() as MItemDoc;
      if (!x.parentItemId) items.push(x);
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }

  progress("Lecture des commentaires…");
  const notesByItem = new Map<string, LeadNote[]>();
  last = null;
  for (;;) {
    const cons: any[] = [m.where("boardId", "==", board.id)];
    if (last) cons.push(m.startAfter(last));
    cons.push(m.limit(500));
    const snap = await (m.getDocs as any)((m.query as any)(m.collection(db, "monday_updates"), ...cons));
    for (const d of snap.docs) {
      const u = d.data() as any;
      const list = notesByItem.get(String(u.itemId)) ?? [];
      list.push({ id: String(d.id).slice(-10), text: String(u.text ?? "").slice(0, 3000), by: u.author || "Monday", at: String(u.at || ""), kind: "note" });
      for (const r of u.replies ?? []) list.push({ id: String(r.id).slice(-10), text: String(r.text ?? "").slice(0, 3000), by: r.author || "Monday", at: String(r.at || u.at || ""), kind: "note" });
      notesByItem.set(String(u.itemId), list);
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }

  // Fichiers qui ne sont dans aucune colonne « fichiers » (pièces jointes de la ligne ou d'un commentaire) : colonne « Autres fichiers ».
  const fileColIds = new Set(mapped.filter((x) => x.type === "filecol").map((x) => x.col.id));
  const withOtherFiles = items.some((it) => (it.files ?? []).some((f) => f.url && !fileColIds.has(String(f.col ?? ""))));

  progress("Création du tableau et de ses colonnes…");
  const groups: LeadGroup[] = [...board.groups]
    .filter((g) => !g.archived)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((g) => ({ id: g.id, title: g.title, color: g.color && g.color.startsWith("#") ? g.color : "#579bfc" }));
  if (!groups.length) groups.push({ id: "nouveaux", title: "Éléments", color: "#579bfc" });
  await m.setDoc(m.doc(db, "crm_boards", boardId), { groups: JSON.parse(JSON.stringify(groups)), updatedAt: m.serverTimestamp(), updatedBy: email, mondayBoardId: board.id });
  await m.setDoc(m.doc(db, "crm_boards", `${boardId}_columns`), { config: JSON.parse(JSON.stringify(buildColumnsConfig(board, mapped, withOtherFiles))), updatedAt: m.serverTimestamp(), updatedBy: email });

  let done = 0;
  for (let i = 0; i < items.length; i += 400) {
    const batch = m.writeBatch(db);
    for (const it of items.slice(i, i + 400)) {
      const fields: Record<string, string> = {};
      let phone = "";
      let mail = "";
      let rappel = "";
      for (const mc of mapped) {
        const v = valueOf(mc, it);
        if (!v) continue;
        if (mc.target === "core-phone") phone = v;
        else if (mc.target === "core-email") mail = v.toLowerCase();
        else if (mc.target === "core-rappel") rappel = v;
        else fields[mc.key] = v;
      }
      const created = new Date(it.createdAt);
      const notes = (notesByItem.get(String(it.itemId)) ?? []).sort((a, b) => (a.at < b.at ? -1 : 1)).slice(-100);
      // Fichiers : chaque colonne « fichiers » reçoit ses fichiers ; le reste va dans « Autres fichiers ».
      const fileCols: Record<string, unknown> = {};
      const byCol = new Map<string, FileRef[]>();
      for (const f of it.files ?? []) {
        if (!f.url) continue;
        const key = fileColIds.has(String(f.col ?? "")) ? `m_${f.col}` : OTHER_FILES_KEY;
        const ref: FileRef = { id: String(f.id), name: f.name, url: f.url, ...(f.path ? { path: f.path } : {}), ...(f.size ? { size: f.size } : {}), ...(f.ext ? { ext: f.ext } : {}) };
        byCol.set(key, [...(byCol.get(key) ?? []), ref]);
      }
      byCol.forEach((list, key) => (fileCols[key] = m.arrayUnion(...list)));
      // Écriture « fusionnée » : relancer l'intégration met à jour les données de Monday sans effacer
      // les notes, fichiers ou colonnes ajoutés ensuite dans le CRM.
      batch.set(
        m.doc(db, "crm_leads", `m${board.id}_${it.itemId}`),
        {
          name: it.name,
          phone,
          email: mail,
          postalCode: "",
          city: "",
          type: "Autre",
          source: `Monday : ${board.name}`.slice(0, 80),
          projet: "",
          status: "nouveau_lead",
          group: it.groupId || groups[0].id,
          board: boardId,
          fields,
          rappelLe: rappel,
          details: {},
          ...(notes.length ? { notes: m.arrayUnion(...notes) } : {}),
          ...(Object.keys(fileCols).length ? { fileCols } : {}),
          docCount: 0,
          docCats: [],
          createdAt: isNaN(created.getTime()) ? m.serverTimestamp() : m.Timestamp.fromDate(created),
          updatedAt: m.serverTimestamp(),
          updatedBy: email,
        },
        { merge: true },
      );
    }
    await batch.commit();
    done += Math.min(400, items.length - i);
    progress(`${done} / ${items.length} lignes copiées…`);
  }

  // Entrée dans le menu, dossier « Tableau IP5 » (une seule fois).
  const exists = sidebar.config.folders.some((f) => f.items.some((x) => x.board === boardId));
  if (exists) {
    // Le tableau était déjà dans le menu (peut-être à la corbeille ou archivé) : on le remet bien en place.
    const wasHidden = sidebar.config.folders.some((f) => f.items.some((x) => x.board === boardId && (x.deletedAt || x.archived)));
    if (wasHidden)
      await sidebar.save({
        ...sidebar.config,
        folders: sidebar.config.folders.map((f) => ({
          ...f,
          collapsed: f.items.some((x) => x.board === boardId) ? false : f.collapsed,
          items: f.items.map((x) => {
            if (x.board !== boardId) return x;
            const { deletedAt, ...rest } = x;
            return { ...rest, archived: false };
          }),
        })),
      });
  } else {
    const entry: SideItem = {
      id: `i_${boardId}`,
      kind: "view",
      page: "leads",
      title: board.name,
      board: boardId,
      view: { filters: [], sorts: [], groupBy: "", personKey: "", visible: [] },
    };
    const target = sidebar.config.folders.find((f) => f.id === "f_tableau") ?? sidebar.config.folders[0];
    await sidebar.save({
      ...sidebar.config,
      folders: sidebar.config.folders.map((f) => (f.id === target.id ? { ...f, collapsed: false, items: [...f.items, entry] } : f)),
    });
  }
  return { boardId, items: items.length };
}
