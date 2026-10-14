import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { crmFirestore } from "@/lib/crmDb";
import { getEspaceProApp } from "@/lib/espacePro";
import {
  CRM_DOCUMENTS_COLLECTION,
  DOC_CATEGORIES,
  REQUIRED_ARTISAN_DOCS,
  REQUIRED_LEAD_DOCS,
  documentFromDoc,
  formatSize,
  guessCategory,
  isImage,
  type CrmDocument,
  type DocCategory,
  type OwnerType,
} from "@/lib/crmDocs";
import { formatShortDate } from "@/lib/crm";

// Panneau « Documents » d'une fiche (lead ou artisan) : envoi par
// glisser-déposer (plusieurs fichiers à la fois, avec progression), catégories,
// aperçus des photos, pièces manquantes. La liste vient de l'index Firestore
// crm_documents : elle inclut aussi les pièces reçues par mail et celles
// reprises de Monday.

type Upload = { key: string; name: string; progress: number; error?: string };

const safeName = (n: string) => n.replace(/[^\w.\- ()àâäçéèêëîïôöùûüÿ]/gi, "_").slice(0, 120);

export default function DocumentsPanel({
  ownerType,
  ownerId,
  ownerName,
  email,
  stored,
  onSummary,
}: {
  ownerType: OwnerType;
  ownerId: string;
  ownerName: string;
  email: string;
  // Valeurs actuellement enregistrées sur la fiche : sert à les resynchroniser.
  stored: { docCount: number; docCats: string[] };
  onSummary: (summary: { docCount: number; docCats: string[] }) => void;
}) {
  const [docs, setDocs] = useState<CrmDocument[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const syncedRef = useRef("");

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    setDocs(null);
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.query(m.collection(db, CRM_DOCUMENTS_COLLECTION), m.where("ownerId", "==", ownerId)),
          (snap) => {
            if (cancelled) return;
            const list = snap.docs
              .map((d) => documentFromDoc(d.id, d.data()))
              .filter((d) => !d.deletedAt)
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
            setDocs(list);
          },
          (e) => {
            console.error(e);
            setError("Impossible de charger les documents (règles Firestore crm_documents à publier ?).");
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
  }, [ownerId]);

  const cats = useMemo(() => Array.from(new Set((docs ?? []).map((d) => d.category))).sort(), [docs]);

  // Garde le compteur et les catégories de la fiche à jour (colonne « Docs »).
  useEffect(() => {
    if (!docs) return;
    const sig = `${ownerId}|${docs.length}|${cats.join(",")}`;
    const storedSig = `${ownerId}|${stored.docCount}|${[...stored.docCats].sort().join(",")}`;
    if (sig !== storedSig && syncedRef.current !== sig) {
      syncedRef.current = sig;
      onSummary({ docCount: docs.length, docCats: cats });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, cats]);

  const required = ownerType === "lead" ? REQUIRED_LEAD_DOCS : REQUIRED_ARTISAN_DOCS;

  const uploadOne = async (original: File) => {
    const key = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setUploads((u) => [...u, { key, name: original.name, progress: 0 }]);
    const fail = (msg: string) =>
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: msg } : x)));
    try {
      if (original.size > 50 * 1024 * 1024) return fail("Plus de 50 Mo");
      const file = original; // jamais de compression : le document reste exactement tel qu'envoyé
      const app = await getEspaceProApp();
      const st = await import("firebase/storage");
      const { m, db } = await crmFirestore();
      const folder = `crm/${ownerType === "lead" ? "leads" : "artisans"}/${ownerId}`;
      const path = `${folder}/${Date.now()}_${safeName(file.name)}`;
      const ref = st.ref(st.getStorage(app), path);
      await new Promise<void>((resolve, reject) => {
        const task = st.uploadBytesResumable(ref, file, { contentType: file.type || undefined });
        task.on(
          "state_changed",
          (s) =>
            setUploads((u) =>
              u.map((x) => (x.key === key ? { ...x, progress: s.bytesTransferred / s.totalBytes } : x)),
            ),
          reject,
          () => resolve(),
        );
      });
      // Vérifie que le fichier est bien arrivé en entier avant de l'ajouter à l'index.
      const meta = await st.getMetadata(ref);
      if (Number(meta.size) !== file.size) throw new Error(`Fichier incomplet (${meta.size}/${file.size})`);
      const url = await st.getDownloadURL(ref);
      const entry = {
        ownerType,
        ownerId,
        ownerName,
        name: file.name,
        category: guessCategory(file.name),
        size: file.size,
        contentType: file.type,
        path,
        url,
        source: "upload",
        uploadedBy: email,
        createdAt: m.serverTimestamp(),
      };
      // Trois essais pour ranger le fichier dans l'index (coupure réseau passagère).
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await m.addDoc(m.collection(db, CRM_DOCUMENTS_COLLECTION), entry);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
      if (lastErr) throw lastErr;
      setUploads((u) => u.filter((x) => x.key !== key));
    } catch (e) {
      console.error(e);
      fail("Échec de l'envoi");
    }
  };

  const uploadMany = (files: FileList | File[] | null) => {
    if (!files) return;
    setError("");
    // 3 envois en parallèle : plus rapide sans saturer la connexion.
    const queue = Array.from(files);
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) await uploadOne(f);
    };
    for (let i = 0; i < Math.min(3, queue.length); i++) worker();
  };

  const setCategory = async (d: CrmDocument, category: DocCategory) => {
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, CRM_DOCUMENTS_COLLECTION, d.id), { category });
    } catch (e) {
      console.error(e);
      setError("Impossible de changer la catégorie.");
    }
  };

  // Jamais d'effacement direct : le document passe à la corbeille (restaurable 30 jours).
  const remove = async (d: CrmDocument) => {
    if (!confirm(`Mettre « ${d.name} » à la corbeille ?\n\nIl reste récupérable pendant 30 jours.`)) return;
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, CRM_DOCUMENTS_COLLECTION, d.id), { deletedAt: m.serverTimestamp(), deletedBy: email });
    } catch (e) {
      console.error(e);
      setError("Échec : le document n'a pas été déplacé.");
    }
  };

  return (
    <div
      className={`pt-3 border-t border-gray-100 rounded-lg ${drag ? "bg-blue-50 ring-2 ring-[#579bfc]" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        uploadMany(e.dataTransfer.files);
      }}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
        <Paperclip size={13} /> Documents {docs ? `(${docs.length})` : ""}
      </span>

      {/* Pièces à réunir */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {required.map((c) => {
          const ok = cats.includes(c);
          return (
            <span
              key={c}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                ok ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {ok ? <CheckCircle2 size={11} /> : <Circle size={11} />} {c}
            </span>
          );
        })}
      </div>

      {docs === null && <p className="text-xs text-gray-400">Chargement…</p>}
      {docs && docs.length === 0 && uploads.length === 0 && (
        <p className="text-xs text-gray-400 mb-2">Aucun document. Glissez des fichiers ici.</p>
      )}

      {docs && docs.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-1.5">
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 w-10 h-10 rounded bg-white border border-gray-200 flex items-center justify-center overflow-hidden"
              >
                {isImage(d) ? (
                  <img src={d.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <FileText size={18} className="text-gray-400" />
                )}
              </a>
              <div className="min-w-0 flex-1">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs font-semibold text-[#2b5a8f] truncate"
                  title={d.name}
                >
                  {d.name}
                </a>
                <p className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
                  {d.source === "mail" && <Mail size={10} />}
                  {formatSize(d.size)} · {formatShortDate(d.createdAt)}
                  {d.source === "mail" ? " · reçu par mail" : d.source === "monday" ? " · repris de Monday" : ""}
                </p>
                <select
                  value={d.category}
                  onChange={(e) => setCategory(d, e.target.value as DocCategory)}
                  className="mt-0.5 w-full text-[11px] bg-white border border-gray-200 rounded px-1 py-0.5 text-gray-700"
                >
                  {DOC_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => remove(d)}
                className="text-gray-400 hover:text-red-600 shrink-0 p-1"
                aria-label={`Supprimer ${d.name}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploads.map((u) => (
        <div key={u.key} className="mb-1.5 text-xs">
          <div className="flex justify-between text-gray-600">
            <span className="truncate">{u.name}</span>
            {u.error ? (
              <button
                onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}
                className="text-red-600 font-semibold"
              >
                {u.error} ✕
              </button>
            ) : (
              <span>{Math.round(u.progress * 100)} %</span>
            )}
          </div>
          {!u.error && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#579bfc]" style={{ width: `${u.progress * 100}%` }} />
            </div>
          )}
        </div>
      ))}

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2b5a8f] cursor-pointer">
        {uploads.some((u) => !u.error) ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Ajouter des documents (PDF, photos…) ou les glisser ici
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            uploadMany(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
