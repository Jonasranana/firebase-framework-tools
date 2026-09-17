import { useEffect, useMemo, useState } from "react";
import {
  Phone,
  Mail,
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  Paperclip,
  Trash2,
  Upload,
  Check,
} from "lucide-react";
import { getEspaceProApp } from "@/lib/espacePro";

// ─────────────────────────────────────────────────────────────────────────
// Onglet Clients — liste des leads du tableau Monday "Lead venant du site
// internet", lue depuis Firestore (collection crm_clients, synchronisée
// toutes les 15 min par .github/workflows/sync-crm-data.yml, voir
// scripts/sync-crm-to-firestore.mjs). La lecture se fait avec la session
// Google de l'Espace Pro (voir lib/espacePro.ts) : les données ne sont
// visibles qu'aux e-mails autorisés par les règles de sécurité Firestore.
// Aucun appel direct à l'API Monday depuis le navigateur : le jeton Monday
// ne quitte jamais le serveur.
//
// Champs "internes" (statutCRM, notesCRM, pièces jointes) : propres à cet
// outil, jamais touchés par la synchro Monday (voir updateMask côté
// sync-crm-to-firestore.mjs) — on peut les modifier ici sans craindre
// qu'ils soient écrasés au prochain passage de la synchro.
// ─────────────────────────────────────────────────────────────────────────

type Client = {
  id: string;
  name: string;
  groupe: string;
  statut: string;
  commentaire: string;
  telephone: string;
  telHref: string;
  recuLe: string;
  email: string;
  projet: string;
  source: string;
  departement: string;
  typeLogement: string;
  surface: string;
  chauffage: string;
  proprietaire: string;
  foyer: string;
  revenus: string;
  echeance: string;
  contactPro: string;
  typeSite: string;
  nbVehicules: string;
  createdAt: string;
  statutCRM?: string;
  notesCRM?: string;
  updatedAt?: string;
  updatedBy?: string;
};

const GROUPE_COLOR: Record<string, string> = {
  PAC: "bg-orange-100 text-orange-700",
  Solaire: "bg-yellow-100 text-yellow-700",
  SMS: "bg-blue-100 text-blue-700",
  gonflage: "bg-purple-100 text-purple-700",
};

function groupeStyle(groupe: string) {
  const key = Object.keys(GROUPE_COLOR).find((k) =>
    groupe.toLowerCase().includes(k.toLowerCase()),
  );
  return key ? GROUPE_COLOR[key] : "bg-gray-100 text-gray-700";
}

const STATUT_COLOR: Record<string, string> = {
  positif: "bg-green-100 text-green-700",
  "rdv fixé": "bg-green-100 text-green-700",
  contacté: "bg-blue-100 text-blue-700",
  new: "bg-red-100 text-red-700",
  refus: "bg-gray-200 text-gray-600",
  "non qualifié": "bg-gray-200 text-gray-600",
  nrp: "bg-amber-100 text-amber-700",
  "nrp 2": "bg-amber-100 text-amber-700",
  message: "bg-indigo-100 text-indigo-700",
};

function statutStyle(statut: string) {
  return STATUT_COLOR[statut.toLowerCase()] ?? "bg-gray-100 text-gray-600";
}

// Pipeline de suivi interne — propre à IP5, indépendant du statut Monday.
const STATUT_CRM_OPTIONS = [
  "À contacter",
  "Contacté",
  "RDV fixé",
  "Devis envoyé",
  "Dossier déposé",
  "Installé",
  "Perdu",
] as const;

const STATUT_CRM_COLOR: Record<string, string> = {
  "À contacter": "bg-gray-100 text-gray-600",
  Contacté: "bg-blue-100 text-blue-700",
  "RDV fixé": "bg-indigo-100 text-indigo-700",
  "Devis envoyé": "bg-amber-100 text-amber-700",
  "Dossier déposé": "bg-violet-100 text-violet-700",
  Installé: "bg-green-100 text-green-700",
  Perdu: "bg-red-100 text-red-700",
};

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

type StorageFile = { name: string; url: string };

// ── Carte client : lecture + édition du suivi interne + pièces jointes ─────
const ClientCard = ({
  client,
  email,
  onSaved,
}: {
  client: Client;
  email: string;
  onSaved: (id: string, patch: Partial<Client>) => void;
}) => {
  const c = client;
  const [open, setOpen] = useState(false);
  const [statutCRM, setStatutCRM] = useState(c.statutCRM ?? "À contacter");
  const [notesCRM, setNotesCRM] = useState(c.notesCRM ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [files, setFiles] = useState<StorageFile[] | null>(null);
  const [filesError, setFilesError] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadFiles = async () => {
    try {
      const app = await getEspaceProApp();
      const { getStorage, ref, listAll, getDownloadURL } = await import(
        "firebase/storage"
      );
      const storage = getStorage(app);
      const folder = ref(storage, `crm/${c.id}`);
      const res = await listAll(folder);
      const list = await Promise.all(
        res.items.map(async (item) => ({
          name: item.name,
          url: await getDownloadURL(item),
        })),
      );
      setFiles(list);
    } catch (e) {
      console.error(e);
      setFilesError("Impossible de charger les fichiers.");
    }
  };

  useEffect(() => {
    if (open && files === null) loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const app = await getEspaceProApp();
      const { getFirestore, doc, updateDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );
      const db = getFirestore(app);
      await updateDoc(doc(db, "crm_clients", c.id), {
        statutCRM,
        notesCRM,
        updatedAt: serverTimestamp(),
        updatedBy: email,
      });
      onSaved(c.id, {
        statutCRM,
        notesCRM,
        updatedBy: email,
        updatedAt: new Date().toISOString(),
      });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setFilesError("");
      alert("Échec de l'enregistrement. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setFilesError("");
    try {
      const app = await getEspaceProApp();
      const { getStorage, ref, uploadBytes } = await import(
        "firebase/storage"
      );
      const storage = getStorage(app);
      for (const file of Array.from(fileList)) {
        await uploadBytes(ref(storage, `crm/${c.id}/${file.name}`), file);
      }
      await loadFiles();
    } catch (e) {
      console.error(e);
      setFilesError("Échec de l'envoi. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (name: string) => {
    if (!confirm(`Supprimer « ${name} » ?`)) return;
    try {
      const app = await getEspaceProApp();
      const { getStorage, ref, deleteObject } = await import(
        "firebase/storage"
      );
      const storage = getStorage(app);
      await deleteObject(ref(storage, `crm/${c.id}/${name}`));
      setFiles((prev) => prev?.filter((f) => f.name !== name) ?? null);
    } catch (e) {
      console.error(e);
      setFilesError("Échec de la suppression. Réessayez.");
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-gray-900">{c.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {c.groupe && (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${groupeStyle(c.groupe)}`}
              >
                {c.groupe}
              </span>
            )}
            {c.statut && (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statutStyle(c.statut)}`}
              >
                {c.statut}
              </span>
            )}
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_CRM_COLOR[statutCRM] ?? "bg-gray-100 text-gray-600"}`}
            >
              {statutCRM}
            </span>
          </div>
        </div>
        {c.recuLe && (
          <span className="text-[11px] text-gray-400 whitespace-nowrap">
            {formatDate(c.recuLe)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {c.telHref && (
          <a
            href={c.telHref}
            className="inline-flex items-center gap-1.5 bg-[#2b5a8f] text-white text-sm font-bold px-3 py-1.5 rounded-full"
          >
            <Phone size={13} /> {c.telephone}
          </a>
        )}
        {c.email && (
          <a
            href={`mailto:${c.email}`}
            className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-full"
          >
            <Mail size={12} /> {c.email}
          </a>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500">
        {c.projet && (
          <div>
            <dt className="inline text-gray-400">Projet : </dt>
            <dd className="inline font-semibold text-gray-700">{c.projet}</dd>
          </div>
        )}
        {c.departement && (
          <div>
            <dt className="inline text-gray-400">Dépt : </dt>
            <dd className="inline font-semibold text-gray-700">{c.departement}</dd>
          </div>
        )}
        {c.revenus && (
          <div>
            <dt className="inline text-gray-400">Profil : </dt>
            <dd className="inline font-semibold text-gray-700">{c.revenus}</dd>
          </div>
        )}
        {c.echeance && (
          <div>
            <dt className="inline text-gray-400">Échéance : </dt>
            <dd className="inline font-semibold text-gray-700">{c.echeance}</dd>
          </div>
        )}
        {c.typeLogement && (
          <div>
            <dt className="inline text-gray-400">Logement : </dt>
            <dd className="inline font-semibold text-gray-700">
              {c.typeLogement}
              {c.surface ? ` (${c.surface} m²)` : ""}
            </dd>
          </div>
        )}
        {c.chauffage && (
          <div>
            <dt className="inline text-gray-400">Chauffage : </dt>
            <dd className="inline font-semibold text-gray-700">{c.chauffage}</dd>
          </div>
        )}
        {c.contactPro && (
          <div>
            <dt className="inline text-gray-400">Contact : </dt>
            <dd className="inline font-semibold text-gray-700">{c.contactPro}</dd>
          </div>
        )}
        {c.typeSite && (
          <div>
            <dt className="inline text-gray-400">Type de site : </dt>
            <dd className="inline font-semibold text-gray-700">{c.typeSite}</dd>
          </div>
        )}
      </dl>

      {c.commentaire && (
        <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
          {c.commentaire}
        </p>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-[#2b5a8f] py-2 border-t border-gray-100"
      >
        {open ? "Réduire" : "Gérer le suivi"}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-1 space-y-3">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">
              Statut interne
            </span>
            <select
              value={statutCRM}
              onChange={(e) => {
                setStatutCRM(e.target.value);
                setDirty(true);
              }}
              className="w-full text-sm font-semibold bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#2b5a8f]"
            >
              {STATUT_CRM_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">
              Notes internes
            </span>
            <textarea
              value={notesCRM}
              onChange={(e) => {
                setNotesCRM(e.target.value);
                setDirty(true);
              }}
              rows={3}
              placeholder="Suivi, prochaine relance, détails du dossier…"
              className="w-full text-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#2b5a8f] resize-none"
            />
          </label>

          <button
            onClick={save}
            disabled={!dirty || saving}
            className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300 rounded-xl py-2.5 transition-colors"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <Check size={14} />
            ) : null}
            {saved ? "Enregistré" : "Enregistrer"}
          </button>

          {c.updatedAt && c.updatedBy && (
            <p className="text-[11px] text-gray-400">
              Dernière mise à jour par {c.updatedBy}
            </p>
          )}

          <div className="pt-2 border-t border-gray-100">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
              <Paperclip size={13} /> Pièces jointes
            </span>

            {files === null && (
              <p className="text-xs text-gray-400">Chargement…</p>
            )}
            {files && files.length === 0 && (
              <p className="text-xs text-gray-400 mb-2">Aucun fichier.</p>
            )}
            {files && files.length > 0 && (
              <ul className="space-y-1 mb-2">
                {files.map((f) => (
                  <li
                    key={f.name}
                    className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5"
                  >
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#2b5a8f] truncate"
                    >
                      {f.name}
                    </a>
                    <button
                      onClick={() => deleteFile(f.name)}
                      className="text-gray-400 hover:text-red-600 shrink-0"
                      aria-label={`Supprimer ${f.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {filesError && (
              <p className="text-xs text-red-600 mb-2">{filesError}</p>
            )}

            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2b5a8f] cursor-pointer">
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              {uploading ? "Envoi…" : "Ajouter un fichier"}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => uploadFiles(e.target.files)}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ClientsCRM({ email }: { email: string }) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const app = await getEspaceProApp();
      const { getFirestore, collection, getDocs } = await import(
        "firebase/firestore"
      );
      const db = getFirestore(app);
      const snap = await getDocs(collection(db, "crm_clients"));
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Client, "id">),
      }));
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setClients(list);
      setLoadedAt(new Date());
    } catch (e) {
      console.error(e);
      setError(
        "Impossible de charger la liste des clients. Vérifiez que vous êtes autorisé, puis réessayez.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaved = (id: string, patch: Partial<Client>) => {
    setClients((prev) =>
      prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } : c)) : prev,
    );
  };

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.telephone, c.email, c.departement, c.projet, c.groupe]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [clients, query]);

  return (
    <div>
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (nom, téléphone, département…)"
          className="w-full text-sm bg-white border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-3 outline-none focus:border-[#2b5a8f] transition-colors"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
        <span>
          {clients ? `${filtered.length} client${filtered.length > 1 ? "s" : ""}` : ""}
          {loadedAt && (
            <>
              {" "}
              — actualisé{" "}
              {loadedAt.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </>
          )}
        </span>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 font-semibold text-[#2b5a8f]"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {loading && !clients && (
        <div className="py-10 text-center text-gray-400">
          <Loader2 className="animate-spin mx-auto mb-2" size={24} />
          Chargement…
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        {filtered.map((c) => (
          <ClientCard key={c.id} client={c} email={email} onSaved={handleSaved} />
        ))}

        {clients && filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            Aucun client ne correspond à la recherche.
          </p>
        )}
      </div>
    </div>
  );
}
