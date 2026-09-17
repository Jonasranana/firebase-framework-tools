import { useEffect, useMemo, useState } from "react";
import { Phone, Mail, Search, RefreshCw, Loader2 } from "lucide-react";
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

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function ClientsCRM() {
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
          <div
            key={c.id}
            className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4"
          >
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
          </div>
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
