import { useEffect, useMemo, useState } from "react";
import { Archive, RotateCcw, Search, Trash2 } from "lucide-react";
import { crmFirestore } from "@/lib/crmDb";
import { useLeads } from "@/lib/crmStore";
import { BASE_LEAD_COLUMNS, cellValue, type ColumnsConfig, type LeadColumn } from "@/lib/crmColumns";
import { purgeColumn, restoreColumn } from "@/lib/crmColumnsConfig";

// ─────────────────────────────────────────────────────────────────────────
// « Les archives de Pac Pac » : toutes les colonnes archivées du tableau Pac Pac, avec
// leurs valeurs, dans un tableau à part (lecture seule). Chaque colonne peut
// être réactivée (elle revient dans Pac Pac avec ses valeurs, à sa place) ou
// supprimée définitivement (elle ne pourra plus être réactivée).
// Les colonnes simplement « supprimées » restent dans la Corbeille (30 jours).
// ─────────────────────────────────────────────────────────────────────────
const DOC = "leads_columns";

export default function PacPacArchive({ email, onOpenLead }: { email: string; onOpenLead?: (id: string) => void }) {
  const { data: leads } = useLeads();
  const [cfg, setCfg] = useState<ColumnsConfig | null>(null);
  const [q, setQ] = useState("");
  const [toutes, setToutes] = useState(false);
  const [limit, setLimit] = useState(100);
  const [err, setErr] = useState("");

  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    crmFirestore()
      .then(({ m, db }) => {
        if (dead) return;
        off = m.onSnapshot(m.doc(db, "crm_boards", DOC), (s: any) => setCfg((s.data()?.config as ColumnsConfig | undefined) ?? {}), () => setCfg({}));
      })
      .catch(() => setCfg({}));
    return () => {
      dead = true;
      off?.();
    };
  }, []);

  const write = async (next: ColumnsConfig) => {
    setErr("");
    try {
      const { m, db } = await crmFirestore();
      await m.setDoc(m.doc(db, "crm_boards", DOC), { config: next, updatedAt: m.serverTimestamp(), updatedBy: email });
    } catch (e) {
      console.error(e);
      setErr("Impossible d'enregistrer. Réessayez.");
    }
  };

  // Colonnes archivées, avec leur définition (colonne d'origine ou colonne ajoutée à la main).
  const cols = useMemo(() => {
    const out: { col: LeadColumn; at: string }[] = [];
    for (const e of cfg?.colTrash ?? []) {
      if (e.kind !== "archive") continue;
      const base = BASE_LEAD_COLUMNS.find((c) => c.key === e.key);
      const col = e.col ?? base;
      if (!col) continue;
      out.push({ col: { ...col, title: cfg?.titles?.[e.key] ?? e.title ?? col.title, options: cfg?.options?.[e.key] ?? col.options }, at: e.at });
    }
    return out;
  }, [cfg]);

  // Valeur lisible d'une case (étiquette au lieu de la clé pour les colonnes d'étiquettes).
  const lire = (l: any, c: LeadColumn) => {
    const v = cellValue(l, c);
    if (!v || v === "vide") return "";
    const o = c.options?.find((x) => x.key === v);
    return o ? o.label : v;
  };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (leads ?? [])
      .filter((l) => (l.board || "leads") === "leads")
      .filter((l) => toutes || cols.some(({ col }) => lire(l, col)))
      .filter((l) => !s || `${l.name} ${l.phone} ${l.city} ${l.postalCode}`.toLowerCase().includes(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, cols, q, toutes]);

  const remplies = (c: LeadColumn) => (leads ?? []).filter((l) => (l.board || "leads") === "leads" && lire(l, c)).length;

  if (!cfg || !leads) return <p className="text-sm text-gray-500 py-10 text-center">Chargement…</p>;

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-4 [color-scheme:light] [&_input]:bg-white [&_input]:text-gray-900">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[280px]">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Archive size={22} className="text-gray-400" /> Les archives de Pac Pac
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Les colonnes archivées de Pac Pac, avec toutes leurs valeurs. Réactivez une colonne pour la remettre dans Pac Pac à sa place, ou supprimez-la
            définitivement.
          </p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg w-64" />
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!cols.length ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
          Aucune colonne archivée. Dans Pac Pac, menu « ··· » d'une colonne → « Archiver la colonne ».
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span>
              <b className="text-gray-900">{cols.length}</b> colonne{cols.length > 1 ? "s" : ""} archivée{cols.length > 1 ? "s" : ""} ·{" "}
              <b className="text-gray-900">{rows.length}</b> fiche{rows.length > 1 ? "s" : ""}
            </span>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={toutes} onChange={(e) => setToutes(e.target.checked)} /> Afficher aussi les fiches sans aucune valeur archivée
            </label>
          </div>
          <div className="bg-white border border-[#eceef3] rounded-2xl overflow-auto max-h-[calc(100vh-240px)]">
            <table className="text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-20 bg-gray-50 border-b border-r border-[#eceef3] text-left px-3 py-2 min-w-[220px]">Client</th>
                  {cols.map(({ col, at }) => (
                    <th key={col.key} className="sticky top-0 z-10 bg-gray-50 border-b border-r border-[#eceef3] text-left px-3 py-2 min-w-[180px] align-top">
                      <span className="block font-bold text-gray-900">{col.title}</span>
                      <span className="block text-[11px] font-normal text-gray-500">
                        {remplies(col)} fiche{remplies(col) > 1 ? "s" : ""} remplie{remplies(col) > 1 ? "s" : ""} · archivée le {new Date(at).toLocaleDateString("fr-FR")}
                      </span>
                      <span className="flex gap-1 mt-1.5">
                        <button
                          onClick={() => cfg && write(restoreColumn(cfg, col.key))}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#2563eb] hover:bg-[#1d4ed8] rounded-md px-2 py-1"
                          title="Remettre la colonne dans Pac Pac, avec ses valeurs"
                        >
                          <RotateCcw size={11} /> Réactiver
                        </button>
                        <button
                          onClick={() =>
                            cfg &&
                            confirm(`Supprimer définitivement la colonne « ${col.title} » ? Elle ne pourra plus être réactivée.`) &&
                            write(purgeColumn(cfg, col.key))
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 border border-red-200 hover:bg-red-50 rounded-md px-2 py-1"
                          title="Supprimer la colonne pour de bon"
                        >
                          <Trash2 size={11} /> Supprimer
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-[#eceef3] px-3 py-1.5 whitespace-nowrap">
                      {onOpenLead ? (
                        <button onClick={() => onOpenLead(l.id)} className="font-semibold text-gray-900 hover:text-[#2552d0] hover:underline text-left">
                          {l.name || "Sans nom"}
                        </button>
                      ) : (
                        <span className="font-semibold text-gray-900">{l.name || "Sans nom"}</span>
                      )}
                    </td>
                    {cols.map(({ col }) => (
                      <td key={col.key} className="border-b border-r border-[#eceef3] px-3 py-1.5 text-gray-700 max-w-[260px] truncate" title={lire(l, col)}>
                        {lire(l, col) || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > limit && (
              <div className="p-3 text-center">
                <button onClick={() => setLimit((n) => n + 200)} className="text-sm font-semibold text-[#2552d0] hover:underline">
                  Afficher 200 fiches de plus ({rows.length - limit} restantes)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
