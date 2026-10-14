import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FileText, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { crmFirestore } from "@/lib/crmDb";

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

function BoardView({ board, onBack }: { board: MBoard; onBack: () => void }) {
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

export default function ArchivesMonday() {
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
  if (current) return <BoardView board={current} onBack={() => setCurrent(null)} />;

  const states = ["active", "archived", "deleted"];
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">📦 Archives Monday</h2>
        <p className="text-sm text-gray-500">Copie complète de Monday, en lecture seule : colonnes, étiquettes, commentaires et fichiers.</p>
      </div>
      <form
        onSubmit={(e) => (e.preventDefault(), searchAll())}
        className="flex gap-2"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans tous les tableaux : nom, e-mail ou téléphone…" className="flex-1 text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-3 py-2" />
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
      {boards.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">L'archive n'est pas encore remplie.</p>}
      {states.map((st) => {
        const list = boards.filter((b) => b.state === st).sort((a, b) => (b.itemsArchived ?? b.itemsCount) - (a.itemsArchived ?? a.itemsCount));
        if (!list.length) return null;
        return (
          <section key={st}>
            <h3 className="text-sm font-bold text-gray-600 mb-2">{STATE_LABEL[st]} ({list.length})</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((b) => (
                <button key={b.id} onClick={() => setCurrent(b)} className="text-left bg-white rounded-xl border border-gray-200 hover:border-[#0073ea] p-3 shadow-sm">
                  <div className="text-sm font-bold text-gray-900 truncate">{b.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {b.itemsArchived ?? b.itemsCount} lignes{b.filesCount ? ` · ${b.filesCount} fichiers` : ""}
                    {b.workspace ? ` · ${b.workspace}` : ""}
                  </div>
                  {!b.complete && <div className="text-[11px] text-orange-600 mt-1">Copie en cours…</div>}
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <p className="text-xs text-gray-400 flex items-center gap-1"><Download size={12} /> Les fichiers s'ouvrent depuis le stockage du CRM (aucun lien Monday ne reste nécessaire).</p>
    </div>
  );
}
