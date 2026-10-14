import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useTrashedLeads } from "@/lib/crmStore";
import { CRM_LEADS_COLLECTION, formatPhone } from "@/lib/crm";
import { crmFirestore } from "@/lib/crmDb";
import { CRM_DOCUMENTS_COLLECTION, documentFromDoc, formatSize, type CrmDocument } from "@/lib/crmDocs";

// ─────────────────────────────────────────────────────────────────────────
// Corbeille de secours : une fiche supprimée ou fusionnée y reste 30 jours,
// récupérable en un clic. Elle est effacée pour de bon seulement ensuite
// (tâche quotidienne .github/workflows/purge-crm-trash.yml).
// ─────────────────────────────────────────────────────────────────────────
const DAY = 86400000;

export default function CorbeilleCRM({ email }: { email: string }) {
  const { data, error } = useTrashedLeads();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [docs, setDocs] = useState<CrmDocument[]>([]);

  // Documents mis à la corbeille (fichiers conservés, restaurables 30 jours).
  const loadDocs = async () => {
    try {
      const { m, db } = await crmFirestore();
      const snap = await m.getDocs(m.query(m.collection(db, CRM_DOCUMENTS_COLLECTION), m.where("deletedAt", ">=", new Date(0)), m.limit(300)));
      setDocs(snap.docs.map((d: any) => documentFromDoc(d.id, d.data())).sort((a: CrmDocument, b: CrmDocument) => b.deletedAt.localeCompare(a.deletedAt)));
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => {
    loadDocs();
  }, []);

  const restoreDoc = async (id: string) => {
    setBusy(id);
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, CRM_DOCUMENTS_COLLECTION, id), { deletedAt: m.deleteField(), deletedBy: m.deleteField() });
      await loadDocs();
    } catch (e) {
      console.error(e);
      window.alert("Impossible de restaurer ce document. Réessayez.");
    } finally {
      setBusy("");
    }
  };

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data ?? [])
      .filter((l) => !n || `${l.name} ${l.phone} ${l.email}`.toLowerCase().includes(n))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }, [data, q]);

  const restore = async (id: string) => {
    setBusy(id);
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, CRM_LEADS_COLLECTION, id), {
        deletedAt: m.deleteField(),
        deletedBy: m.deleteField(),
        mergedInto: m.deleteField(),
        updatedAt: m.serverTimestamp(),
        updatedBy: email,
      });
    } catch (e) {
      console.error(e);
      window.alert("Impossible de restaurer. Réessayez.");
    } finally {
      setBusy("");
    }
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <Loader2 className="animate-spin text-gray-400 mx-auto my-10" />;

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <h2 className="text-xl font-extrabold text-gray-900">🗑️ Corbeille</h2>
      <p className="text-sm text-gray-500">
        Les fiches supprimées ou fusionnées restent ici <b>30 jours</b>, puis sont effacées définitivement. D'ici là, vous pouvez les restaurer.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher (nom, téléphone, e-mail)…"
        className="w-full text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-3 py-2"
      />
      {list.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">La corbeille est vide.</p>}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {list.slice(0, 200).map((l) => {
          const left = Math.max(0, 30 - Math.floor((Date.now() - Date.parse(l.deletedAt)) / DAY));
          return (
            <div key={l.id} className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{l.name || "Sans nom"}</div>
                <div className="text-xs text-gray-500 truncate">
                  {[formatPhone(l.phone), l.email].filter(Boolean).join(" · ")}
                </div>
                <div className="text-xs text-gray-400">
                  {l.mergedInto ? "Fusionnée avec une autre fiche" : "Mise à la corbeille"}
                  {l.deletedBy ? ` par ${l.deletedBy}` : ""} · effacée définitivement dans {left} jour{left > 1 ? "s" : ""}
                </div>
              </div>
              <button
                disabled={busy === l.id}
                onClick={() => restore(l.id)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0073ea] border border-[#0073ea]/40 rounded-md px-3 py-1.5 hover:bg-blue-50 disabled:opacity-50"
              >
                <RotateCcw size={14} /> Restaurer
              </button>
            </div>
          );
        })}
      </div>
      {docs.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-gray-700 pt-4">📎 Documents supprimés ({docs.length})</h3>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {docs.map((d) => {
              const left = Math.max(0, 30 - Math.floor((Date.now() - Date.parse(d.deletedAt)) / DAY));
              return (
                <div key={d.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{d.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {d.ownerName} · {formatSize(d.size)} · effacé définitivement dans {left} jour{left > 1 ? "s" : ""}
                    </div>
                  </div>
                  <button
                    disabled={busy === d.id}
                    onClick={() => restoreDoc(d.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0073ea] border border-[#0073ea]/40 rounded-md px-3 py-1.5 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Restaurer
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
