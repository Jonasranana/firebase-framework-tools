import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FileText, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { crmFirestore } from "@/lib/crmDb";
import { useSidebar } from "@/lib/crmSidebar";
import { boardIdFor, integrateMondayBoard } from "@/lib/mondayIntegrate";

// ─────────────────────────────────────────────────────────────────────────
// Archives Monday : copie en lecture seule de tous les tableaux Monday
// (colonnes, étiquettes colorées, groupes, commentaires, fichiers), remplie
// par scripts/import-monday-archive.mjs. Rien ici n'est modifiable.
// ─────────────────────────────────────────────────────────────────────────
type MCol = { id: string; title: string; type: string; settings_str?: string; archived?: boolean };
type MGroup = { id: string; title: string; color?: string; archived?: boolean; position?: string };
type MBoard = {
  id: string; name: string; state: string; workspace: string; folder: string; itemsCount: number;
  columns: MCol[]; groups: MGroup[]; complete?: boolean; filesCount?: number; itemsArchived?: number;
};
type MFile = { id: string; name: string; url?: string; size?: number; col?: string; error?: string; skipped?: string };
type MItem = {
  id: string; boardId: string; boardName: string; name: string; groupId: string; groupTitle: string;
  createdAt: string; updatedAt: string; creator: string; cols: Record<string, { type: string; t?: string; d?: string; v?: string }>;
  files: MFile[]; updatesCount: number; s?: string; parentItemId?: string;
};
type MUpdate = { id: string; text: string; author: string; at: string; files: MFile[]; replies: { id: string; text: string; author: string; at: string }[] };

const STATE_LABEL: Record<string, string> = { active: "Actifs", archived: "Archivés", deleted: "Supprimés dans Monday" };
const PAGE = 500;
const ymd = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const fmtSize = (n?: number) => (n ? (n > 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1e3))} Ko`) : "");

// Couleur d'une étiquette de statut d'après les réglages de la colonne.
function statusColor(col: MCol, value?: string, text?: string): string | null {
  try {
    const st = JSON.parse(col.settings_str || "{}");
    const colors = st.labels_colors ?? {};
    let idx: string | undefined;
    if (value) idx = String(JSON.parse(value).index);
    if ((idx === undefined || idx === "undefined") && text) idx = Object.keys(st.labels ?? {}).find((k) => st.labels[k] === text);
    const c = idx !== undefined ? colors[idx]?.color : undefined;
    return c ?? null;
  } catch {
    return null;
  }
}

function Cell({ col, item }: { col: MCol; item: MItem }) {
  const c = item.cols[col.id];
  if (col.type === "file") {
    const fs = item.files.filter((f) => f.col === col.id);
    if (!fs.length) return <span className="text-gray-300">—</span>;
    return (
      <span className="flex flex-wrap gap-1">
        {fs.map((f) => (
          <FileChip key={f.id} f={f} />
        ))}
      </span>
    );
  }
  const text = c?.t || c?.d || "";
  if (!text) return <span className="text-gray-300">—</span>;
  if (col.type === "status" || col.type === "color") {
    const bg = statusColor(col, c?.v, text) ?? "#c4c4c4";
    return (
      <span className="inline-block text-xs font-semibold text-white rounded px-2 py-0.5" style={{ background: bg }}>
        {text}
      </span>
    );
  }
  if (col.type === "dropdown" || col.type === "tags") {
    return (
      <span className="flex flex-wrap gap-1">
        {text.split(",").map((t) => (
          <span key={t} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
            {t.trim()}
          </span>
        ))}
      </span>
    );
  }
  return <span className="text-sm text-gray-800 line-clamp-2 break-words">{text}</span>;
}

const FileChip = ({ f }: { f: MFile }) =>
  f.url ? (
    <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs bg-blue-50 text-[#0073ea] rounded px-1.5 py-0.5 max-w-[180px]" title={f.name}>
      <FileText size={11} className="shrink-0" />
      <span className="truncate">{f.name}</span>
    </a>
  ) : (
    <span className="inline-flex text-xs bg-red-50 text-red-600 rounded px-1.5 py-0.5" title={f.error || f.skipped}>
      {f.name} (non copié)
    </span>
  );

function ItemDialog({ item, board, onClose }: { item: MItem; board: MBoard; onClose: () => void }) {
  const [updates, setUpdates] = useState<MUpdate[] | null>(null);
  useEffect(() => {
    (async () => {
      const { m, db } = await crmFirestore();
      const snap = await m.getDocs(m.query(m.collection(db, "monday_updates"), m.where("itemKey", "==", `${item.boardId}_${item.id}`)));
      setUpdates(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }) as MUpdate).sort((a: MUpdate, b: MUpdate) => b.at.localeCompare(a.at)));
    })().catch(() => setUpdates([]));
  }, [item]);
  const cols = board.columns.filter((c) => c.type !== "name" && !c.archived);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-white text-gray-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <p className="text-xs text-gray-500">
            {board.name} · groupe « {item.groupTitle} » · créé le {ymd(item.createdAt)} {item.creator ? `par ${item.creator}` : ""}
          </p>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {cols.map((c) => (
            <div key={c.id} className="border-b border-gray-100 pb-1.5">
              <div className="text-[11px] font-semibold text-gray-400">{c.title}</div>
              <Cell col={c} item={item} />
            </div>
          ))}
        </div>
        {item.files.filter((f) => !board.columns.some((c) => c.id === f.col)).length > 0 && (
          <div>
            <div className="text-xs font-bold text-gray-500 mb-1">Autres fichiers</div>
            <div className="flex flex-wrap gap-1">
              {item.files
                .filter((f) => !board.columns.some((c) => c.id === f.col))
                .map((f) => (
                  <FileChip key={f.id} f={f} />
                ))}
            </div>
          </div>
        )}
        <div>
          <div className="text-sm font-bold mb-2">Commentaires ({item.updatesCount})</div>
          {updates === null && <Loader2 className="animate-spin text-gray-400" size={16} />}
          {updates?.map((u) => (
            <div key={u.id} className="rounded-lg border border-gray-200 p-3 mb-2">
              <div className="text-xs text-gray-500 mb-1">
                <b>{u.author}</b> · {ymd(u.at)}
              </div>
              <p className="text-sm whitespace-pre-wrap">{u.text}</p>
              {u.files?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {u.files.map((f) => (
                    <FileChip key={f.id} f={f} />
                  ))}
                </div>
              )}
              {u.replies?.map((r) => (
                <div key={r.id} className="mt-2 ml-4 pl-3 border-l-2 border-gray-200 text-sm">
                  <div className="text-xs text-gray-500">
                    <b>{r.author}</b> · {ymd(r.at)}
                  </div>
                  <p className="whitespace-pre-wrap">{r.text}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IntegrateButton({ board, email }: { board: MBoard; email: string }) {
  const sidebar = useSidebar(email);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const already = sidebar.config.folders.some((f) => f.items.some((i) => i.board === boardIdFor(board.id)));
  const run = async () => {
    if (!board.complete && !confirm("La copie de ce tableau n'est pas terminée : seules les lignes déjà archivées seront intégrées. Continuer ?")) return;
    if (!confirm(`Intégrer « ${board.name} » dans le dossier « Tableau IP5 » ? Un nouveau tableau est créé avec les mêmes colonnes, groupes, lignes et commentaires. L'archive n'est pas modifiée.`)) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await integrateMondayBoard(board, email, sidebar, setMsg);
      setMsg(`Terminé : ${r.items} lignes intégrées. Le tableau est dans le menu, dossier « Tableau IP5 ».`);
      setDone(true);
    } catch (e: any) {
      console.error(e);
      setMsg(`Échec de l'intégration : ${e?.message ?? "erreur inconnue"}. Rien n'a été supprimé, vous pouvez réessayer.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-[#0073ea] hover:bg-[#0060c2] disabled:opacity-60 rounded-md px-3 py-2"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {already || done ? "Mettre à jour dans Tableau IP5" : "Intégrer dans Tableau IP5"}
      </button>
      {msg && <span className={`text-xs ${msg.startsWith("Échec") ? "text-red-600" : "text-gray-600"}`}>{msg}</span>}
    </div>
  );
}

function BoardView({ board, onBack, email }: { board: MBoard; onBack: () => void; email: string }) {
  const [items, setItems] = useState<MItem[]>([]);
  const [last, setLast] = useState<any>(null);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<MItem | null>(null);

  const load = async (reset = false) => {
    setLoading(true);
    try {
      const { m, db } = await crmFirestore();
      const cons: any[] = [m.where("boardId", "==", board.id)];
      if (last && !reset) cons.push(m.startAfter(last));
      cons.push(m.limit(PAGE));
      const snap = await m.getDocs((m.query as any)(m.collection(db, "monday_items"), ...cons));
      const rows = snap.docs.map((d: any) => ({ id: d.data().itemId, ...d.data() }) as MItem);
      setItems((prev) => (reset ? rows : [...prev, ...rows]));
      setLast(snap.docs[snap.docs.length - 1] ?? last);
      setMore(snap.size === PAGE);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load(true);
  }, [board.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cols = board.columns.filter((c) => !c.archived);
  const shown = useMemo(() => {
    const n = norm(q.trim());
    return n ? items.filter((i) => (i.s ?? norm(i.name)).includes(n)) : items;
  }, [items, q]);
  const groups = useMemo(() => {
    const order = [...(board.groups ?? [])].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
    const ids = new Set(order.map((g) => g.id));
    const extra = Array.from(new Set(shown.filter((i) => !ids.has(i.groupId)).map((i) => i.groupId))).map((id) => ({ id, title: shown.find((i) => i.groupId === id)?.groupTitle || "Autres", color: "#7f8794" }));
    return [...order, ...extra].filter((g) => shown.some((i) => i.groupId === g.id));
  }, [board, shown]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-[#0073ea] font-semibold">
          <ArrowLeft size={15} /> Tous les tableaux
        </button>
        <h2 className="text-lg font-extrabold">{board.name}</h2>
        <span className="text-xs text-gray-400">
          {board.itemsArchived ?? board.itemsCount} lignes · {board.filesCount ?? 0} fichiers · {STATE_LABEL[board.state] ?? board.state}
        </span>
        <div className="basis-full order-last"><IntegrateButton board={board} email={email} /></div>
        <div className="ml-auto relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans ce tableau…" className="pl-8 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-md w-64" />
        </div>
      </div>
      <div className="overflow-x-auto pb-4 space-y-5">
        {groups.map((g) => {
          const rows = shown.filter((i) => i.groupId === g.id);
          return (
            <section key={g.id} style={{ minWidth: 240 + cols.length * 170 }}>
              <h3 className="text-base font-bold mb-1" style={{ color: g.color || "#579bfc" }}>
                {g.title} <span className="text-xs font-normal text-gray-400">{rows.length}</span>
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="grid text-xs font-semibold text-gray-500 border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: `240px repeat(${cols.filter((c) => c.type !== "name").length}, 170px)` }}>
                  <div className="px-2 py-1.5" style={{ borderLeft: `6px solid ${g.color || "#579bfc"}` }}>Élément</div>
                  {cols.filter((c) => c.type !== "name").map((c) => (
                    <div key={c.id} className="px-2 py-1.5 border-l border-gray-100 truncate" title={c.title}>
                      {c.title}
                    </div>
                  ))}
                </div>
                {rows.map((i) => (
                  <div key={i.id} className="grid border-b border-gray-100 hover:bg-gray-50 items-center" style={{ gridTemplateColumns: `240px repeat(${cols.filter((c) => c.type !== "name").length}, 170px)` }}>
                    <button onClick={() => setOpen(i)} className="px-2 py-1.5 text-left text-sm font-medium text-gray-900 truncate flex items-center gap-1" style={{ borderLeft: `6px solid ${g.color || "#579bfc"}` }} title={i.name}>
                      <span className="truncate">{i.name}</span>
                      {i.updatesCount > 0 && <span className="text-[10px] bg-[#ff5ac4] text-white rounded-full px-1.5">{i.updatesCount}</span>}
                    </button>
                    {cols.filter((c) => c.type !== "name").map((c) => (
                      <div key={c.id} className="px-2 py-1 border-l border-gray-100 min-w-0 overflow-hidden">
                        <Cell col={c} item={i} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {loading && <Loader2 className="animate-spin text-gray-400 mx-auto" />}
      {more && !loading && (
        <button onClick={() => load()} className="mx-auto block text-sm font-semibold text-[#0073ea] border border-[#0073ea]/40 rounded-md px-4 py-2">
          Charger {PAGE} lignes de plus
        </button>
      )}
      {open && <ItemDialog item={open} board={board} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Liste des tableaux : statut, espace de travail, filtre par nom, tri
// (lignes, fichiers, nom) et regroupement par espace / dossier Monday.
const lines = (b: MBoard) => b.itemsArchived ?? b.itemsCount ?? 0;
const SORTS: Record<string, { label: string; fn: (a: MBoard, b: MBoard) => number }> = {
  lignes: { label: "Plus de lignes", fn: (a, b) => lines(b) - lines(a) },
  fichiers: { label: "Plus de fichiers", fn: (a, b) => (b.filesCount ?? 0) - (a.filesCount ?? 0) || lines(b) - lines(a) },
  nom: { label: "Nom (A → Z)", fn: (a, b) => a.name.localeCompare(b.name, "fr") },
  moins: { label: "Moins de lignes", fn: (a, b) => lines(a) - lines(b) },
};
const fmtN = (n: number) => n.toLocaleString("fr-FR");

function BoardList({ boards, onOpen }: { boards: MBoard[]; onOpen: (b: MBoard) => void }) {
  const [state, setState] = useState("active");
  const [ws, setWs] = useState("");
  const [name, setName] = useState("");
  const [sort, setSort] = useState("lignes");
  const [group, setGroup] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(true);

  const total = useMemo(() => ({
    boards: boards.length,
    lines: boards.reduce((n, b) => n + lines(b), 0),
    files: boards.reduce((n, b) => n + (b.filesCount ?? 0), 0),
    done: boards.filter((b) => b.complete).length,
  }), [boards]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: boards.length };
    for (const b of boards) c[b.state] = (c[b.state] ?? 0) + 1;
    return c;
  }, [boards]);
  const workspaces = useMemo(() => Array.from(new Set(boards.map((b) => b.workspace || "Sans espace"))).sort((a, b) => a.localeCompare(b, "fr")), [boards]);

  const list = useMemo(() => {
    const n = norm(name.trim());
    return boards
      .filter((b) => (state === "all" || b.state === state)
        && (!ws || (b.workspace || "Sans espace") === ws)
        && (!hideEmpty || lines(b) > 0)
        && (!n || norm(`${b.name} ${b.folder ?? ""}`).includes(n)))
      .sort(SORTS[sort].fn);
  }, [boards, state, ws, name, sort, hideEmpty]);

  const sections = useMemo(() => {
    if (!group) return [{ key: "", title: "", boards: list }];
    const map = new Map<string, MBoard[]>();
    for (const b of list) {
      const k = [b.workspace || "Sans espace", b.folder].filter(Boolean).join(" › ");
      map.set(k, [...(map.get(k) ?? []), b]);
    }
    return Array.from(map, ([key, bs]) => ({ key, title: key, boards: bs }))
      .sort((a, b) => b.boards.reduce((n, x) => n + lines(x), 0) - a.boards.reduce((n, x) => n + lines(x), 0));
  }, [list, group]);

  const select = "text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-2.5 py-2";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Tableaux", fmtN(total.boards)],
          ["Lignes", fmtN(total.lines)],
          ["Fichiers", fmtN(total.files)],
          ["Copie terminée", `${fmtN(total.done)} / ${fmtN(total.boards)}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="text-xs text-gray-500">{k}</div>
            <div className="text-lg font-bold text-gray-900">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["active", "archived", "deleted", "all"].map((st) => (counts[st] ?? 0) > 0 && (
          <button key={st} onClick={() => setState(st)} className={`text-sm font-semibold rounded-full px-3.5 py-1.5 border ${state === st ? "bg-[#0073ea] text-white border-[#0073ea]" : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"}`}>
            {st === "all" ? "Tous" : STATE_LABEL[st]} <span className="opacity-70">({counts[st]})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Filtrer les tableaux par nom…" className="w-full pl-8 pr-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md" />
        </div>
        <select value={ws} onChange={(e) => setWs(e.target.value)} className={select} aria-label="Espace de travail">
          <option value="">Tous les espaces</option>
          {workspaces.map((w) => <option key={w}>{w}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={select} aria-label="Trier">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} /> Regrouper par dossier
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} /> Masquer les vides
        </label>
      </div>

      <p className="text-xs text-gray-500">{fmtN(list.length)} tableau{list.length > 1 ? "x" : ""} affiché{list.length > 1 ? "s" : ""}</p>
      {list.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Aucun tableau ne correspond.</p>}

      {sections.map((sec) => (
        <section key={sec.key}>
          {sec.title && (
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-baseline gap-2">
              {sec.title}
              <span className="text-xs font-normal text-gray-400">{sec.boards.length} tableau{sec.boards.length > 1 ? "x" : ""} · {fmtN(sec.boards.reduce((n, b) => n + lines(b), 0))} lignes</span>
            </h3>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sec.boards.map((b) => (
              <button key={b.id} onClick={() => onOpen(b)} className="text-left bg-white rounded-xl border border-gray-200 hover:border-[#0073ea] hover:shadow p-3 shadow-sm transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-bold text-gray-900 truncate">{b.name}</div>
                  {state === "all" && b.state !== "active" && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{b.state === "archived" ? "Archivé" : "Supprimé"}</span>
                  )}
                </div>
                <div className="mt-2 flex gap-3 text-xs text-gray-600">
                  <span><b className="text-gray-900">{fmtN(lines(b))}</b> lignes</span>
                  <span><b className="text-gray-900">{fmtN(b.filesCount ?? 0)}</b> fichiers</span>
                </div>
                {!group && (b.workspace || b.folder) && (
                  <div className="text-[11px] text-gray-400 mt-1 truncate">{[b.workspace, b.folder].filter(Boolean).join(" › ")}</div>
                )}
                {!b.complete && <div className="text-[11px] text-orange-600 mt-1">Copie en cours…</div>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function ArchivesMonday({ email = "" }: { email?: string }) {
  const [boards, setBoards] = useState<MBoard[] | null>(null);
  const [current, setCurrent] = useState<MBoard | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MItem[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      const { m, db } = await crmFirestore();
      const snap = await m.getDocs(m.collection(db, "monday_boards"));
      setBoards(snap.docs.map((d: any) => d.data() as MBoard));
    })().catch((e) => {
      console.error(e);
      setBoards([]);
    });
  }, []);

  // Recherche dans TOUS les tableaux : un mot du nom, un e-mail ou un numéro de téléphone.
  const searchAll = async () => {
    const raw = q.trim();
    if (!raw) return setHits(null);
    setSearching(true);
    try {
      const { m, db } = await crmFirestore();
      const digits = raw.replace(/\D/g, "");
      const key = raw.includes("@") ? raw.toLowerCase() : digits.length >= 9 ? `tel${digits.slice(-9)}` : norm(raw).split(/[^a-z0-9]+/).filter((t) => t.length >= 3)[0] ?? "";
      if (!key) return setHits([]);
      const snap = await m.getDocs(m.query(m.collection(db, "monday_items"), m.where("keys", "array-contains", key), m.limit(100)));
      setHits(snap.docs.map((d: any) => ({ id: d.data().itemId, ...d.data() }) as MItem));
    } finally {
      setSearching(false);
    }
  };

  if (!boards) return <Loader2 className="animate-spin text-gray-400 mx-auto my-10" />;
  if (current) return <BoardView board={current} onBack={() => setCurrent(null)} email={email} />;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">📦 Archives Monday</h2>
        <p className="text-sm text-gray-500">Copie complète de Monday, en lecture seule : colonnes, étiquettes, commentaires et fichiers.</p>
      </div>
      <form
        onSubmit={(e) => (e.preventDefault(), searchAll())}
        className="flex gap-2"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client dans tous les tableaux : nom, e-mail ou téléphone…" className="flex-1 text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-3 py-2" />
        <button className="text-sm font-semibold text-white bg-[#0073ea] rounded-md px-4">{searching ? "…" : "Chercher"}</button>
      </form>
      {hits && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {hits.length === 0 && <p className="p-4 text-sm text-gray-400">Aucun résultat.</p>}
          {hits.map((h) => {
            const b = boards.find((x) => x.id === h.boardId);
            return (
              <button key={`${h.boardId}_${h.id}`} onClick={() => b && setCurrent(b)} className="w-full text-left p-3 hover:bg-gray-50">
                <div className="text-sm font-semibold">{h.name}</div>
                <div className="text-xs text-gray-500">{h.boardName} · {h.groupTitle}</div>
              </button>
            );
          })}
        </div>
      )}
      {boards.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">L'archive n'est pas encore remplie.</p>
      ) : (
        <BoardList boards={boards} onOpen={setCurrent} />
      )}
      <p className="text-xs text-gray-400 flex items-center gap-1"><Download size={12} /> Les fichiers s'ouvrent depuis le stockage du CRM (aucun lien Monday ne reste nécessaire).</p>
    </div>
  );
}
