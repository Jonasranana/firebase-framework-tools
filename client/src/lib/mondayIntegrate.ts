import { crmFirestore } from "@/lib/crmDb";
import type { ColumnsConfig, LeadColumn } from "@/lib/crmColumns";
import type { LeadGroup, LeadNote, Opt } from "@/lib/crm";
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
type MItemDoc = { itemId: string; name: string; groupId: string; createdAt: string; parentItemId?: string; cols: Record<string, { type: string; t?: string; d?: string; v?: string }> };

export const boardIdFor = (mondayId: string) => `board_m${mondayId}`;

// Couleurs d'étiquettes Monday (si la couleur n'est pas déjà en hexadécimal).
const FALLBACK = ["#fdab3d", "#00c875", "#df2f4a", "#007eb5", "#9d50dd", "#579bfc", "#ffcb00", "#037f4c", "#ff642e", "#7f8794"];

function labelsOf(col: MCol): Opt[] {
  try {
    const st = JSON.parse(col.settings_str || "{}");
    let names: [string, string][] = [];
    if (Array.isArray(st.labels)) names = st.labels.map((l: any) => [String(l.id), String(l.name ?? l.label ?? "")]);
    else if (st.labels && typeof st.labels === "object") names = Object.entries(st.labels).map(([k, v]) => [k, String(v)]);
    const colors = st.labels_colors ?? {};
    return names
      .filter(([, label]) => label)
      .map(([k, label], i) => {
        const c = colors[k]?.color;
        return { key: label, label, hex: typeof c === "string" && c.startsWith("#") ? c : FALLBACK[i % FALLBACK.length] };
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
    if (c.type === "file" || c.type === "subtasks" || c.type === "button") continue;
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

const WIDTH: Record<string, number> = { status: 160, text: 180, longtext: 240, number: 110, date: 130 };

function valueOf(m: Mapped, item: MItemDoc): string {
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

export function buildColumnsConfig(board: MBoardLite, mapped: Mapped[]): ColumnsConfig {
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
  const titles: Record<string, string> = {};
  for (const m of mapped) if (m.target.startsWith("core-")) titles[m.key] = m.col.title;
  return {
    baseOnly: ["name", "rappel", "phone", "email", "docs", "maj", "creation"],
    custom,
    titles: { name: "Nom", ...titles },
    order: ["name", ...mapped.map((m) => m.key), "docs", "maj", "creation"],
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

  progress("Création du tableau et de ses colonnes…");
  const groups: LeadGroup[] = [...board.groups]
    .filter((g) => !g.archived)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((g) => ({ id: g.id, title: g.title, color: g.color && g.color.startsWith("#") ? g.color : "#579bfc" }));
  if (!groups.length) groups.push({ id: "nouveaux", title: "Éléments", color: "#579bfc" });
  await m.setDoc(m.doc(db, "crm_boards", boardId), { groups, updatedAt: m.serverTimestamp(), updatedBy: email, mondayBoardId: board.id });
  await m.setDoc(m.doc(db, "crm_boards", `${boardId}_columns`), { config: buildColumnsConfig(board, mapped), updatedAt: m.serverTimestamp(), updatedBy: email });

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
      batch.set(m.doc(db, "crm_leads", `m${board.id}_${it.itemId}`), {
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
        notes,
        docCount: 0,
        docCats: [],
        createdAt: isNaN(created.getTime()) ? m.serverTimestamp() : m.Timestamp.fromDate(created),
        updatedAt: m.serverTimestamp(),
        updatedBy: email,
      });
    }
    await batch.commit();
    done += Math.min(400, items.length - i);
    progress(`${done} / ${items.length} lignes copiées…`);
  }

  // Entrée dans le menu, dossier « Tableau IP5 » (une seule fois).
  const exists = sidebar.config.folders.some((f) => f.items.some((x) => x.board === boardId));
  if (!exists) {
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
