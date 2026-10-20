import { useEffect, useState } from "react";
import CorbeilleCRM from "./CorbeilleCRM";
import DoublonsCRM from "./DoublonsCRM";
import { allItems, useSidebar } from "@/lib/crmSidebar";
import { crmFirestore } from "@/lib/crmDb";
import { colDaysLeft, type ColumnsConfig } from "@/lib/crmColumns";
import { purgeColumn, restoreColumn } from "@/lib/crmColumnsConfig";

// Tableaux et éléments du menu supprimés : gardés 30 jours, restaurables ici.
function TableauxSupprimes({ email }: { email: string }) {
  const { config, save } = useSidebar(email);
  const trashed = allItems(config).filter((i) => i.deletedAt);
  if (!trashed.length) return null;
  const restore = (id: string) =>
    save({
      ...config,
      folders: config.folders.map((f) => ({
        ...f,
        items: f.items.map((i) => {
          if (i.id !== id) return i;
          const { deletedAt, ...rest } = i;
          return { ...rest, archived: false };
        }),
      })),
    });
  const left = (iso: string) => Math.max(0, 30 - Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-bold text-gray-800 mb-2">Tableaux supprimés du menu</h3>
      <ul className="divide-y divide-gray-100">
        {trashed.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2">
            <span className="flex-1 text-sm font-semibold text-gray-900 truncate">{t.title}</span>
            <span className="text-xs text-gray-400">{t.core ? "page d'origine" : `${left(t.deletedAt!)} j restants`}</span>
            <button onClick={() => restore(t.id)} className="text-xs font-bold text-white bg-[#0073ea] rounded-md px-3 py-1.5">
              Restaurer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Colonnes supprimées (30 jours) ou archivées (60 jours) d'un tableau : réactivables avec leurs valeurs, ou supprimables pour de bon.
function ColonnesTableau({ boardId, title, email }: { boardId: string; title: string; email: string }) {
  const [cfg, setCfg] = useState<ColumnsConfig>({});
  const docId = boardId === "leads" ? "leads_columns" : `${boardId}_columns`;
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    crmFirestore()
      .then(({ m, db }) => {
        if (dead) return;
        off = m.onSnapshot(m.doc(db, "crm_boards", docId), (s) => setCfg((s.data()?.config as ColumnsConfig | undefined) ?? {}), () => {});
      })
      .catch(() => {});
    return () => {
      dead = true;
      off?.();
    };
  }, [docId]);
  const write = async (next: ColumnsConfig) => {
    const { m, db } = await crmFirestore();
    await m.setDoc(m.doc(db, "crm_boards", docId), { config: next, updatedAt: m.serverTimestamp(), updatedBy: email });
  };
  const list = cfg.colTrash ?? [];
  if (!list.length) return null;
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-bold text-gray-800 mb-2">Colonnes — {title}</h3>
      <ul className="divide-y divide-gray-100">
        {list.map((e) => (
          <li key={e.key} className="flex items-center gap-3 py-2">
            <span className="flex-1 text-sm font-semibold text-gray-900 truncate">{e.title}</span>
            <span className="text-xs text-gray-500">{e.kind === "archive" ? "Archivée" : "Supprimée"} · {colDaysLeft(e)} j restants</span>
            <button onClick={() => write(restoreColumn(cfg, e.key))} className="text-xs font-bold text-white bg-[#0073ea] rounded-md px-3 py-1.5">
              Réactiver
            </button>
            <button
              onClick={() => confirm(`Supprimer définitivement la colonne « ${e.title} » ? Elle ne pourra plus être réactivée.`) && write(purgeColumn(cfg, e.key))}
              className="text-xs font-bold text-red-600 border border-red-200 rounded-md px-3 py-1.5 hover:bg-red-50"
            >
              Supprimer définitivement
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ColonnesSupprimees({ email }: { email: string }) {
  const { config } = useSidebar(email);
  const boards = allItems(config)
    .filter((i) => !i.deletedAt && ((i.core && i.page === "leads") || i.board))
    .map((i) => ({ id: i.board ?? "leads", title: i.title }));
  const seen = new Set<string>();
  return (
    <>
      {boards.filter((b) => !seen.has(b.id) && seen.add(b.id)).map((b) => (
        <ColonnesTableau key={b.id} boardId={b.id} title={b.title} email={email} />
      ))}
    </>
  );
}

// Un seul bouton du menu pour la corbeille de secours et la détection des doublons.
export default function CorbeilleEtDoublons({ email, onOpenLead }: { email: string; onOpenLead: (id: string) => void }) {
  const [tab, setTab] = useState<"corbeille" | "doublons">("corbeille");
  const btn = (k: typeof tab, label: string) => (
    <button
      onClick={() => setTab(k)}
      className={`px-4 py-2 text-sm font-semibold rounded-full border ${tab === k ? "bg-[#0073ea] text-white border-[#0073ea]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-center">
        {btn("corbeille", "🗑️ Corbeille")}
        {btn("doublons", "👥 Doublons")}
      </div>
      {tab === "corbeille" && <TableauxSupprimes email={email} />}
      {tab === "corbeille" && <ColonnesSupprimees email={email} />}
      {tab === "corbeille" ? <CorbeilleCRM email={email} /> : <DoublonsCRM email={email} onOpenLead={onOpenLead} />}
    </div>
  );
}
