import { useEffect, useMemo, useState } from "react";
import { FileText, HardDrive, Loader2, Mail, Search, Trash2 } from "lucide-react";
import { crmFirestore } from "@/lib/crmDb";
import { getEspaceProApp } from "@/lib/espacePro";
import {
  CRM_DOCUMENTS_COLLECTION,
  DOC_CATEGORIES,
  documentFromDoc,
  formatSize,
  isImage,
  type CrmDocument,
  type DocCategory,
} from "@/lib/crmDocs";
import { formatShortDate } from "@/lib/crm";

// Page « Documents » : tous les fichiers du CRM (clients, artisans, pièces
// reçues par mail, fichiers repris de Monday) au même endroit, recherchables
// et filtrables comme un Drive. Les 300 plus récents sont chargés, le bouton
// « Charger plus » en ajoute 300.
const STEP = 300;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function DocumentsPage() {
  const [docs, setDocs] = useState<CrmDocument[] | null>(null);
  const [limit, setLimit] = useState(STEP);
  const [error, setError] = useState("");
  const [total, setTotal] = useState<{ count: number; bytes: number } | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const [source, setSource] = useState("");
  const [owner, setOwner] = useState("");

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.query(m.collection(db, CRM_DOCUMENTS_COLLECTION), m.orderBy("createdAt", "desc"), m.limit(limit)),
          (snap) => !cancelled && setDocs(snap.docs.map((d) => documentFromDoc(d.id, d.data()))),
          (e) => {
            console.error(e);
            setError("Impossible de charger les documents (règle Firestore crm_documents à publier ?).");
            setDocs([]);
          },
        );
      } catch (e) {
        console.error(e);
        setDocs([]);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [limit]);

  // Total du stockage (comptage côté serveur : ne lit pas les fichiers).
  useEffect(() => {
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        const r = await m.getAggregateFromServer(m.collection(db, CRM_DOCUMENTS_COLLECTION), {
          count: m.count(),
          bytes: m.sum("size"),
        });
        setTotal({ count: r.data().count, bytes: r.data().bytes ?? 0 });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [docs?.length]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return (docs ?? []).filter((d) => {
      if (cat && d.category !== cat) return false;
      if (source && d.source !== source) return false;
      if (owner && d.ownerType !== owner) return false;
      return !q || norm(`${d.name} ${d.ownerName} ${d.category}`).includes(q);
    });
  }, [docs, query, cat, source, owner]);

  const setCategory = async (d: CrmDocument, category: DocCategory) => {
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, CRM_DOCUMENTS_COLLECTION, d.id), { category });
    } catch (e) {
      console.error(e);
      setError("Impossible de changer la catégorie.");
    }
  };

  const remove = async (d: CrmDocument) => {
    if (!confirm(`Supprimer « ${d.name} » (${d.ownerName}) ?`)) return;
    try {
      const app = await getEspaceProApp();
      const st = await import("firebase/storage");
      const { m, db } = await crmFirestore();
      await st.deleteObject(st.ref(st.getStorage(app), d.path)).catch((e: any) => {
        if (e?.code !== "storage/object-not-found") throw e;
      });
      await m.deleteDoc(m.doc(db, CRM_DOCUMENTS_COLLECTION, d.id));
    } catch (e) {
      console.error(e);
      setError("Échec de la suppression.");
    }
  };

  const sel = "text-xs font-semibold bg-white border border-gray-200 rounded-full px-3 py-1.5";

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500">Fichiers stockés</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{total ? total.count : "…"}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
            <HardDrive size={12} /> Espace utilisé
          </p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{total ? formatSize(total.bytes) : "…"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un fichier ou un client…"
            className="w-full text-sm bg-white border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 outline-none focus:border-[#2b5a8f]"
          />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={sel}>
          <option value="">Toutes catégories</option>
          {DOC_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={sel}>
          <option value="">Toutes origines</option>
          <option value="upload">Ajoutés à la main</option>
          <option value="mail">Reçus par mail</option>
          <option value="monday">Repris de Monday</option>
        </select>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className={sel}>
          <option value="">Leads et artisans</option>
          <option value="lead">Leads</option>
          <option value="artisan">Artisans</option>
        </select>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {!docs && (
        <div className="py-10 text-center text-gray-400">
          <Loader2 className="animate-spin mx-auto mb-2" size={24} />
          Chargement…
        </div>
      )}
      {docs && docs.length === 0 && !error && (
        <p className="text-center text-gray-400 text-sm py-10">
          Aucun document. Ajoutez-en depuis une fiche lead ou artisan, ou laissez la boîte mail et l'import Monday les ranger ici.
        </p>
      )}

      {docs && docs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[48px_minmax(220px,2fr)_minmax(150px,1.2fr)_200px_80px_80px_90px_40px] text-xs font-semibold text-gray-500 border-b border-gray-200 h-8 items-center px-2 gap-2">
              <span />
              <span>Fichier</span>
              <span>Client / artisan</span>
              <span>Catégorie</span>
              <span>Taille</span>
              <span>Date</span>
              <span>Origine</span>
              <span />
            </div>
            {filtered.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-[48px_minmax(220px,2fr)_minmax(150px,1.2fr)_200px_80px_80px_90px_40px] items-center border-b border-gray-100 px-2 gap-2 py-1.5 hover:bg-gray-50 text-sm"
              >
                <a href={d.url} target="_blank" rel="noreferrer" className="w-10 h-10 rounded bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden">
                  {isImage(d) ? (
                    <img src={d.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <FileText size={18} className="text-gray-400" />
                  )}
                </a>
                <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold text-[#2b5a8f] truncate" title={d.name}>
                  {d.name}
                </a>
                <span className="truncate text-gray-700" title={d.ownerName}>
                  {d.ownerName || "—"}
                  <span className="text-[10px] text-gray-400 ml-1">{d.ownerType === "artisan" ? "artisan" : "lead"}</span>
                </span>
                <select
                  value={d.category}
                  onChange={(e) => setCategory(d, e.target.value as DocCategory)}
                  className="text-xs bg-white border border-gray-200 rounded px-1 py-1"
                >
                  {DOC_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">{formatSize(d.size)}</span>
                <span className="text-xs text-gray-500">{formatShortDate(d.createdAt)}</span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  {d.source === "mail" ? (
                    <>
                      <Mail size={11} /> mail
                    </>
                  ) : d.source === "monday" ? (
                    "Monday"
                  ) : (
                    "manuel"
                  )}
                </span>
                <button onClick={() => remove(d)} aria-label="Supprimer" className="text-gray-400 hover:text-red-600">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Aucun document ne correspond.</p>
            )}
          </div>
        </div>
      )}

      {docs && docs.length >= limit && (
        <button onClick={() => setLimit((n) => n + STEP)} className="w-full text-sm font-bold text-[#2b5a8f] py-3">
          Charger plus de documents
        </button>
      )}
    </div>
  );
}
