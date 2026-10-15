import React, { useEffect, useState, useMemo } from "react";
import {
  ExternalLink,
  Search,
  RefreshCw,
  AlertCircle,
  FileCheck2,
  Calendar,
  Euro,
  User,
  MapPin,
  Clock,
  ShieldAlert,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { getEspaceProApp } from "@/lib/espacePro";
import BrandLoader from "@/components/BrandLoader";

interface PraimyDossier {
  id: string;
  reference: string;
  statut: string;
  global_status: string;
  progress: number;
  is_urgent?: boolean;
  company_nom?: string;
  client_nom?: string;
  client_ville?: string;
  ville?: string;
  address_ban_type?: string;
  created_at?: string;
  updated_at?: string;
  reste_a_charge_ttc?: number;
  montant_ttc?: number;
  prime_cee?: number;
  mpr_amount_eur?: number;
  is_blocked?: boolean;
  awaiting_me?: boolean;
  next_action_label?: string;
}

const STATUT_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  devis: { label: "Devis en cours", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  signature: { label: "En signature", bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  signe: { label: "Signé", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  visite: { label: "Visite technique", bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
  pose: { label: "Installation / Pose", bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700" },
  termine: { label: "Terminé", bg: "bg-green-50 border-green-200", text: "text-green-800" },
  brouillon: { label: "Brouillon", bg: "bg-gray-50 border-gray-200", text: "text-gray-600" },
};

function formatStatus(statut: string, globalStatus?: string) {
  const key = (statut || "").toLowerCase();
  const found = STATUT_BADGES[key];
  if (found) return found;

  const pretty = (statut || globalStatus || "Inconnu")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return { label: pretty, bg: "bg-gray-100 border-gray-200", text: "text-gray-700" };
}

export default function PraimyCRM({ email }: { email: string }) {
  const [dossiers, setDossiers] = useState<PraimyDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("all");

  const loadDossiers = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const app = await getEspaceProApp();
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const functions = getFunctions(app, "europe-west9");
      const listFn = httpsCallable<void, { items: PraimyDossier[] }>(functions, "listPraimyDossiers");
      const res = await listFn();
      setDossiers(res.data?.items ?? []);
    } catch (err: any) {
      setError(err?.message || "Impossible de récupérer les dossiers Praimy.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDossiers();
  }, []);

  const filtered = useMemo(() => {
    return dossiers.filter((d) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        d.reference?.toLowerCase().includes(q) ||
        d.client_nom?.toLowerCase().includes(q) ||
        d.client_ville?.toLowerCase().includes(q) ||
        d.ville?.toLowerCase().includes(q);

      const matchStatut =
        filterStatut === "all" ||
        d.statut?.toLowerCase() === filterStatut.toLowerCase() ||
        d.global_status?.toLowerCase() === filterStatut.toLowerCase();

      return matchQuery && matchStatut;
    });
  }, [dossiers, query, filterStatut]);

  const stats = useMemo(() => {
    const total = dossiers.length;
    const signes = dossiers.filter((d) => d.statut === "signe").length;
    const signatures = dossiers.filter((d) => d.statut === "signature").length;
    const devis = dossiers.filter((d) => d.statut === "devis").length;
    const urgents = dossiers.filter((d) => d.is_urgent).length;
    return { total, signes, signatures, devis, urgents };
  }, [dossiers]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dossiers PRAIMY</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-[#0f2b4a] border border-blue-200">
              API Directe Live
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Synchronisation en direct avec la plateforme PRAIMY pour IP5 Conseils.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDossiers(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-[#0073ea]" : ""} />
            Actualiser
          </button>
          <a
            href="https://portail.praimy.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[#0f2b4a] rounded-lg hover:bg-[#1a3d66] shadow-sm transition"
          >
            Ouvrir Portail Praimy
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Cartes métriques */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Total dossiers</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-emerald-600">Signés</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{stats.signes}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-amber-600">En signature</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{stats.signatures}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-blue-600">Devis / Éligibilité</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{stats.devis}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
            <Flame size={13} /> Urgents
          </p>
          <p className="text-xl font-bold text-rose-700 mt-1">{stats.urgents}</p>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par client, ville ou référence..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
          >
            <option value="all">Tous les statuts</option>
            <option value="devis">Devis</option>
            <option value="signature">En signature</option>
            <option value="signe">Signé</option>
            <option value="visite">Visite technique</option>
            <option value="pose">Pose</option>
          </select>
        </div>
      </div>

      {/* Affichage état de chargement ou erreur */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <BrandLoader />
          <p className="text-sm text-gray-500 mt-4">Connexion à Praimy en cours...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Erreur lors de la synchronisation Praimy</p>
            <p className="text-xs mt-1 text-red-600">{error}</p>
            <button
              onClick={() => loadDossiers()}
              className="mt-2 text-xs font-semibold text-red-800 underline hover:no-underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
          <FileCheck2 size={32} className="mx-auto mb-2 text-gray-400" />
          <p className="font-medium text-sm">Aucun dossier trouvé</p>
          <p className="text-xs text-gray-400 mt-1">Modifiez vos critères de recherche ou vos filtres.</p>
        </div>
      ) : (
        /* Tableau des dossiers */
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Référence</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Secteur</th>
                  <th className="py-3 px-4">Statut Praimy</th>
                  <th className="py-3 px-4">Reste à charge</th>
                  <th className="py-3 px-4">Date de mise à jour</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d) => {
                  const badge = formatStatus(d.statut, d.global_status);
                  const isBlocked = d.is_blocked;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0f2b4a]">
                        <div className="flex items-center gap-1.5">
                          {d.is_urgent && (
                            <span title="Dossier urgent">
                              <Flame size={14} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                          {d.reference || d.id.slice(0, 8)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 flex items-center gap-1.5">
                          <User size={14} className="text-gray-400" />
                          {d.client_nom || "Client sans nom"}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-gray-600">
                        <div className="flex items-center gap-1.5 text-xs">
                          <MapPin size={13} className="text-gray-400" />
                          {d.client_ville || d.ville || "—"}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                        {isBlocked && (
                          <span className="ml-1.5 inline-flex items-center text-xs text-rose-600 font-semibold" title="Dossier bloqué">
                            <ShieldAlert size={13} />
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-medium text-gray-900 text-xs">
                        {typeof d.reste_a_charge_ttc === "number"
                          ? `${d.reste_a_charge_ttc.toLocaleString("fr-FR")} € TTC`
                          : "—"}
                      </td>

                      <td className="py-3 px-4 text-xs text-gray-500">
                        {d.updated_at ? new Date(d.updated_at).toLocaleDateString("fr-FR") : "—"}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <a
                          href={`https://portail.praimy.fr/dossiers/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0073ea] hover:text-[#005bb5] bg-blue-50/60 hover:bg-blue-100/60 px-2.5 py-1.5 rounded-md transition"
                        >
                          Ouvrir
                          <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
