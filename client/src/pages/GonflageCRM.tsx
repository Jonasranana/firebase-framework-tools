import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Search,
  Plus,
  Loader2,
  X,
  Building2,
  ChevronRight,
  FolderOpen,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { LogoIP5 } from "./site-chrome";
import { getEspaceProApp } from "@/lib/espacePro";

// ─────────────────────────────────────────────────────────────────────────
// CRM "Station de gonflage" — suivi des dossiers CEE (fiche TRA-SE-104),
// du questionnaire d'éligibilité jusqu'au paiement de la prime.
// Stocké dans Firestore (collection gonflage_dossiers), protégé par les
// mêmes règles que crm_clients (auth Google + liste blanche, voir
// OutilDevis.tsx). La génération et l'envoi par e-mail des documents à
// signer ne sont pas encore construits — étape suivante une fois le
// besoin précisé.
// ─────────────────────────────────────────────────────────────────────────

const ETAPES = [
  { key: "1", label: "Questionnaire d'éligibilité", color: "bg-teal-100 text-teal-700 border-teal-200" },
  { key: "2", label: "Envoi du pré-devis", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "3", label: "Attente de signature", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "4", label: "Devis CEE à signer", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { key: "5", label: "Planification installation", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { key: "6", label: "Installation faite", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { key: "7", label: "Documents de fin de chantier", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "8", label: "Dépôt des documents", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { key: "9", label: "Dépôt délégataire", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { key: "10", label: "Paiement", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { key: "annule", label: "Annulé / Pas intéressé", color: "bg-gray-200 text-gray-600 border-gray-300" },
] as const;

type EtapeKey = (typeof ETAPES)[number]["key"];

const etapeLabel = (key: string) =>
  ETAPES.find((e) => e.key === key)?.label ?? key;
const etapeColor = (key: string) =>
  ETAPES.find((e) => e.key === key)?.color ?? "bg-gray-100 text-gray-600 border-gray-200";

type Dossier = {
  id: string;
  reference: string;
  raisonSociale: string;
  siren: string;
  nomContact: string;
  email: string;
  telephone: string;
  adresse: string;
  codePostal: string;
  ville: string;
  adresseTravauxDifferente: boolean;
  adresseTravaux: string;
  codePostalTravaux: string;
  villeTravaux: string;
  etape: EtapeKey;
  createdAt: string;
  createdBy: string;
};

const emptyForm = {
  siren: "",
  raisonSociale: "",
  nomContact: "",
  email: "",
  telephone: "",
  adresse: "",
  codePostal: "",
  ville: "",
  adresseTravauxDifferente: false,
  adresseTravaux: "",
  codePostalTravaux: "",
  villeTravaux: "",
};

// ── Recherche SIREN — annuaire public des entreprises (INSEE / api.gouv.fr,
// gratuit, sans clé). ────────────────────────────────────────────────────
async function rechercheSiren(query: string) {
  const res = await fetch(
    `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=1`,
  );
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  const r = data?.results?.[0];
  if (!r) return null;
  const siege = r.siege ?? {};
  return {
    raisonSociale: r.nom_raison_sociale ?? r.nom_complet ?? "",
    siren: r.siren ?? "",
    adresse: siege.adresse ?? siege.numero_voie
      ? [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean).join(" ")
      : "",
    codePostal: siege.code_postal ?? "",
    ville: siege.libelle_commune ?? "",
  };
}

// ── Formulaire "Nouveau dossier" ────────────────────────────────────────
const NewDossierModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [form, setForm] = useState(emptyForm);
  const [sirenQuery, setSirenQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof emptyForm, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const searchSiren = async () => {
    if (!sirenQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const r = await rechercheSiren(sirenQuery.trim());
      if (!r) {
        setSearchError("Aucune entreprise trouvée pour cette recherche.");
        return;
      }
      setForm((f) => ({
        ...f,
        raisonSociale: r.raisonSociale || f.raisonSociale,
        siren: r.siren || f.siren,
        adresse: r.adresse || f.adresse,
        codePostal: r.codePostal || f.codePostal,
        ville: r.ville || f.ville,
      }));
    } catch (e) {
      console.error(e);
      setSearchError("Recherche impossible pour le moment. Réessayez ou remplissez à la main.");
    } finally {
      setSearching(false);
    }
  };

  const canSubmit = form.raisonSociale.trim() && form.siren.trim();

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const app = await getEspaceProApp();
      const { getFirestore, collection, addDoc, serverTimestamp, getAuth } =
        await import("firebase/firestore").then(async (fs) => ({
          ...fs,
          getAuth: (await import("firebase/auth")).getAuth,
        }));
      const db = getFirestore(app);
      const auth = getAuth(app);
      await addDoc(collection(db, "gonflage_dossiers"), {
        ...form,
        etape: "1",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email ?? "",
      });
      onCreated();
    } catch (e) {
      console.error(e);
      alert("Échec de la création du dossier. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Nouveau dossier</h2>
            <p className="text-xs text-gray-400">
              Étape 1 du pipeline : identifier le client bénéficiaire.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <Building2 size={15} /> Auto-remplissage depuis le SIREN
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Données issues de l'annuaire public des entreprises (INSEE / API gratuite).
            </p>
            <div className="flex gap-2">
              <input
                value={sirenQuery}
                onChange={(e) => setSirenQuery(e.target.value)}
                placeholder="SIREN ou raison sociale…"
                className="flex-1 text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#2b5a8f]"
              />
              <button
                onClick={searchSiren}
                disabled={searching}
                className="inline-flex items-center gap-1.5 bg-[#2b5a8f] text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50"
              >
                {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Rechercher
              </button>
            </div>
            {searchError && <p className="text-xs text-red-600 mt-2">{searchError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Raison sociale *" value={form.raisonSociale} onChange={(v) => set("raisonSociale", v)} full />
            <Field label="SIREN *" value={form.siren} onChange={(v) => set("siren", v)} />
            <Field label="Nom du contact" value={form.nomContact} onChange={(v) => set("nomContact", v)} />
            <Field label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" />
            <Field label="Téléphone" value={form.telephone} onChange={(v) => set("telephone", v)} />
            <Field label="Adresse" value={form.adresse} onChange={(v) => set("adresse", v)} full />
            <Field label="Code postal" value={form.codePostal} onChange={(v) => set("codePostal", v)} />
            <Field label="Ville" value={form.ville} onChange={(v) => set("ville", v)} />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.adresseTravauxDifferente}
              onChange={(e) => set("adresseTravauxDifferente", e.target.checked)}
              className="w-4 h-4 accent-[#2b5a8f]"
            />
            Adresse des travaux différente
          </label>

          {form.adresseTravauxDifferente && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adresse des travaux" value={form.adresseTravaux} onChange={(v) => set("adresseTravaux", v)} full />
              <Field label="Code postal" value={form.codePostalTravaux} onChange={(v) => set("codePostalTravaux", v)} />
              <Field label="Ville" value={form.villeTravaux} onChange={(v) => set("villeTravaux", v)} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-bold text-gray-500 rounded-xl hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || saving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300 rounded-xl"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Créer le dossier
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  full = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  full?: boolean;
}) => (
  <label className={`block ${full ? "col-span-2" : ""}`}>
    <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#2b5a8f]"
    />
  </label>
);

// ── Détail d'un dossier ─────────────────────────────────────────────────
const DossierDetail = ({
  dossier,
  onClose,
  onUpdated,
}: {
  dossier: Dossier;
  onClose: () => void;
  onUpdated: (patch: Partial<Dossier>) => void;
}) => {
  const [etape, setEtape] = useState<EtapeKey>(dossier.etape);
  const [saving, setSaving] = useState(false);

  const changeEtape = async (next: EtapeKey) => {
    setEtape(next);
    setSaving(true);
    try {
      const app = await getEspaceProApp();
      const { getFirestore, doc, updateDoc } = await import("firebase/firestore");
      const db = getFirestore(app);
      await updateDoc(doc(db, "gonflage_dossiers", dossier.id), { etape: next });
      onUpdated({ etape: next });
    } catch (e) {
      console.error(e);
      alert("Échec de la mise à jour du statut.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{dossier.raisonSociale}</h2>
            <p className="text-xs text-gray-400">{dossier.ville}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Étape du pipeline</span>
            <select
              value={etape}
              onChange={(e) => changeEtape(e.target.value as EtapeKey)}
              disabled={saving}
              className="w-full text-sm font-bold bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#2b5a8f]"
            >
              {ETAPES.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.key !== "annule" ? `${e.key}. ` : ""}
                  {e.label}
                </option>
              ))}
            </select>
          </label>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <DetailRow k="SIREN" v={dossier.siren} />
            <DetailRow k="Contact" v={dossier.nomContact} />
            <DetailRow k="Email" v={dossier.email} />
            <DetailRow k="Téléphone" v={dossier.telephone} />
            <DetailRow k="Adresse" v={`${dossier.adresse}, ${dossier.codePostal} ${dossier.ville}`} full />
            {dossier.adresseTravauxDifferente && (
              <DetailRow
                k="Adresse des travaux"
                v={`${dossier.adresseTravaux}, ${dossier.codePostalTravaux} ${dossier.villeTravaux}`}
                full
              />
            )}
          </dl>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
            La génération et l'envoi par e-mail des documents à signer (devis
            CEE, etc.) ne sont pas encore construits sur cet onglet — à venir
            une fois le besoin précisé.
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ k, v, full }: { k: string; v: string; full?: boolean }) => (
  <div className={full ? "col-span-2" : ""}>
    <dt className="text-xs text-gray-400">{k}</dt>
    <dd className="font-semibold text-gray-800">{v || "—"}</dd>
  </div>
);

// ── Page principale ──────────────────────────────────────────────────────
export default function GonflageCRM({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) {
  const [view, setView] = useState<"tableau" | "dossiers">("tableau");
  const [dossiers, setDossiers] = useState<Dossier[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"tous" | EtapeKey>("tous");
  const [showNew, setShowNew] = useState(false);
  const [openDossier, setOpenDossier] = useState<Dossier | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const load = async () => {
    setLoading(true);
    try {
      const app = await getEspaceProApp();
      const { getFirestore, collection, getDocs } = await import("firebase/firestore");
      const db = getFirestore(app);
      const snap = await getDocs(collection(db, "gonflage_dossiers"));
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Dossier, "id">) }));
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setDossiers(list);
    } catch (e) {
      console.error(e);
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!dossiers) return [];
    let list = dossiers;
    if (stageFilter !== "tous") list = list.filter((d) => d.etape === stageFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((d) =>
        [d.raisonSociale, d.siren, d.reference, d.ville].join(" ").toLowerCase().includes(q),
      );
    }
    return list;
  }, [dossiers, stageFilter, query]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of ETAPES) counts[e.key] = 0;
    for (const d of dossiers ?? []) counts[d.etape] = (counts[d.etape] ?? 0) + 1;
    return counts;
  }, [dossiers]);

  const signes = (dossiers ?? []).filter((d) =>
    ["5", "6", "7", "8", "9", "10"].includes(d.etape),
  ).length;
  const enAttente = stageCounts["3"] ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-16" dir="ltr">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} aria-label="Retour aux métiers" className="p-1.5 -ml-1.5 text-gray-400 hover:text-gray-700">
              <ArrowLeft size={20} />
            </button>
            <LogoIP5 className="h-9" />
          </div>
          <span className="text-xs text-gray-400">{email}</span>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-2 flex gap-2">
          <button
            onClick={() => setView("tableau")}
            className={`flex-1 text-sm font-bold px-3 py-2 rounded-full transition-colors ${view === "tableau" ? "bg-[#2b5a8f] text-white" : "bg-gray-100 text-gray-500"}`}
          >
            Tableau de bord
          </button>
          <button
            onClick={() => setView("dossiers")}
            className={`flex-1 text-sm font-bold px-3 py-2 rounded-full transition-colors ${view === "dossiers" ? "bg-[#2b5a8f] text-white" : "bg-gray-100 text-gray-500"}`}
          >
            Dossiers
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {loading && (
          <div className="py-20 text-center text-gray-400">
            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
            Chargement…
          </div>
        )}

        {!loading && view === "tableau" && (
          <>
            <h1 className="text-xl font-bold text-gray-900">Bonjour 👋</h1>
            <p className="text-sm text-gray-400 mb-6">Vos dossiers CEE stations de gonflage.</p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard icon={FolderOpen} label="Mes dossiers" value={dossiers?.length ?? 0} color="text-[#2b5a8f]" />
              <StatCard icon={CheckCircle2} label="Dossiers signés" value={signes} color="text-green-600" />
              <StatCard icon={Clock} label="En attente de signature" value={enAttente} color="text-amber-500" />
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900">Dossiers récents</h2>
                <button onClick={() => setView("dossiers")} className="text-sm font-bold text-[#2b5a8f] inline-flex items-center gap-1">
                  Tout voir <ChevronRight size={15} />
                </button>
              </div>
              <div className="space-y-2">
                {(dossiers ?? []).slice(0, 5).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setOpenDossier(d)}
                    className="w-full flex items-center justify-between gap-3 bg-gray-50 rounded-2xl px-4 py-3 text-left hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{d.raisonSociale}</p>
                      <p className="text-xs text-gray-400">{d.ville}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${etapeColor(d.etape)}`}>
                      {etapeLabel(d.etape)}
                    </span>
                  </button>
                ))}
                {dossiers && dossiers.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-6">Aucun dossier pour l'instant.</p>
                )}
              </div>
            </div>
          </>
        )}

        {!loading && view === "dossiers" && (
          <>
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-xl font-bold text-gray-900">Dossiers</h1>
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1.5 bg-[#2b5a8f] text-white text-sm font-bold px-4 py-2.5 rounded-full"
              >
                <Plus size={16} /> Nouveau dossier
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Vos dossiers CEE stations de gonflage.</p>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher une raison sociale, un SIREN, une référence…"
                className="w-full text-sm bg-white border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-3 outline-none focus:border-[#2b5a8f]"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
              <button
                onClick={() => {
                  setStageFilter("tous");
                  setPage(1);
                }}
                className={`shrink-0 text-xs font-bold px-3 py-2 rounded-full border ${stageFilter === "tous" ? "bg-[#2b5a8f] text-white border-[#2b5a8f]" : "bg-white text-gray-600 border-gray-200"}`}
              >
                Tous les dossiers {dossiers?.length ?? 0}
              </button>
              {ETAPES.map((e) => (
                <button
                  key={e.key}
                  onClick={() => {
                    setStageFilter(e.key);
                    setPage(1);
                  }}
                  className={`shrink-0 text-xs font-bold px-3 py-2 rounded-full border whitespace-nowrap ${
                    stageFilter === e.key ? "bg-[#2b5a8f] text-white border-[#2b5a8f]" : `${e.color}`
                  }`}
                >
                  {e.key !== "annule" ? `${e.key}. ` : ""}
                  {e.label} {stageCounts[e.key] ?? 0}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100">
                {paged.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setOpenDossier(d)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{d.raisonSociale}</p>
                      <p className="text-xs text-gray-400">{d.ville}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${etapeColor(d.etape)}`}>
                      {etapeLabel(d.etape)}
                    </span>
                  </button>
                ))}
                {paged.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-10">Aucun dossier ne correspond.</p>
                )}
              </div>
            </div>

            {filtered.length > perPage && (
              <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                <span>
                  {(page - 1) * perPage + 1} – {Math.min(page * perPage, filtered.length)} sur {filtered.length} dossier{filtered.length > 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 font-bold disabled:opacity-40"
                  >
                    Précédent
                  </button>
                  <span className="font-bold text-gray-700">{page}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 font-bold disabled:opacity-40"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showNew && (
        <NewDossierModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}

      {openDossier && (
        <DossierDetail
          dossier={openDossier}
          onClose={() => setOpenDossier(null)}
          onUpdated={(patch) => {
            setOpenDossier((d) => (d ? { ...d, ...patch } : d));
            setDossiers((list) =>
              list ? list.map((d) => (d.id === openDossier.id ? { ...d, ...patch } : d)) : list,
            );
          }}
        />
      )}
    </div>
  );
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof FolderOpen;
  label: string;
  value: number;
  color: string;
}) => (
  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2`}>
      <Icon size={13} /> {label}
    </div>
    <p className={`text-2xl font-black ${color}`}>{value}</p>
  </div>
);
