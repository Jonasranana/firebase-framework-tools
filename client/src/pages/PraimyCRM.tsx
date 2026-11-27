import React, { Fragment, useEffect, useState, useMemo } from "react";
import {
  ExternalLink,
  Search,
  RefreshCw,
  AlertCircle,
  FileCheck2,
  Calendar,
  Euro,
  MapPin,
  Clock,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Phone,
  Check,
} from "lucide-react";
import { getEspaceProApp } from "@/lib/espacePro";
import BrandLoader from "@/components/BrandLoader";
import { useLeads } from "@/lib/crmStore";
import { crmFirestore } from "@/lib/crmDb";
import type { Lead } from "@/lib/crm";
import { SUIVI, SUIVI_KEY, datePoseOf, dateVtOf, makeMatcher, prochainesEtapes, suiviLabel, suiviOf } from "@/lib/suiviPraimy";

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

// Ordre de progression d'un dossier Praimy, du début à la fin.
const STEPS: { key: string; color: string }[] = [
  { key: "brouillon", color: "#9ca3af" },
  { key: "devis", color: "#3b82f6" },
  { key: "signature", color: "#f59e0b" },
  { key: "signe", color: "#10b981" },
  { key: "visite", color: "#8b5cf6" },
  { key: "pose", color: "#6366f1" },
  { key: "termine", color: "#16a34a" },
];
const stepIndex = (statut?: string) => {
  const i = STEPS.findIndex((s) => s.key === (statut || "").toLowerCase());
  return i < 0 ? STEPS.length : i;
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

// Dernière action sur le dossier : mise à jour chez Praimy ou dernière ligne de suivi dans le CRM.
const derniereAction = (updatedAt?: string, lead?: Lead | null) => {
  const dates = [updatedAt ?? "", ...(lead?.notes ?? []).filter((n) => /@/.test(n.by)).map((n) => n.at)].filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : "";
};
const relance = (iso: string) => {
  if (!iso) return { jours: null as number | null, cls: "text-gray-300" };
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return { jours, cls: jours >= 15 ? "bg-red-100 text-red-700" : jours >= 6 ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700" };
};

const frCourt = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "");

// « Avancement » : nos 8 étapes en points reliés. Un clic coche / décoche l'étape (enregistré sur la fiche + trace dans la discussion).
const COURT = ["Propal", "Signée", "MPR à faire", "MPR faite", "VT à caler", "VT calée", "Pose calée", "Installé"];
function Avancement({ lead, email }: { lead: Lead | null; email: string }) {
  const [busy, setBusy] = useState("");
  if (!lead)
    return (
      <span className="text-[11px] text-gray-400" title="Renseignez « Réf Praimy » sur la fiche de ce client dans Pac Pac pour le relier">
        Fiche CRM non reliée
      </span>
    );
  const tags = suiviOf(lead);
  const fait = SUIVI.map((o) => tags.includes(o.key));
  const dernier = fait.lastIndexOf(true);
  const toggle = async (key: string) => {
    const on = tags.includes(key);
    const next = SUIVI.map((o) => o.key).filter((k) => (k === key ? !on : tags.includes(k)));
    setBusy(key);
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, "crm_leads", lead.id), {
        [`fields.${SUIVI_KEY}`]: next.join(","),
        crmOwned: true,
        updatedAt: m.serverTimestamp(),
        updatedBy: email,
        notes: m.arrayUnion({
          id: Math.random().toString(36).slice(2, 12),
          text: `Suivi Praimy : ${on ? "retiré" : "fait"} « ${suiviLabel(key)} »`,
          by: email,
          at: new Date().toISOString(),
          kind: "statut",
        }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="min-w-[230px]">
      <div className="flex items-center">
        {SUIVI.map((o, i) => (
          <Fragment key={o.key}>
            {i > 0 && <span className={`h-[3px] flex-1 min-w-[6px] ${fait[i] && fait[i - 1] ? "bg-[#1f4b7f]" : "bg-gray-200"}`} />}
            <button
              onClick={() => toggle(o.key)}
              disabled={!!busy}
              title={`${o.label} : ${fait[i] ? "fait (cliquer pour annuler)" : "cliquer quand c'est fait"}`}
              className={`h-[22px] w-[22px] shrink-0 rounded-full text-[10px] font-bold flex items-center justify-center transition hover:scale-110 disabled:opacity-60 ${
                fait[i] ? "text-white shadow-sm" : "bg-white text-gray-400 border-2 border-gray-200 hover:border-[#1f4b7f] hover:text-[#1f4b7f]"
              } ${busy === o.key ? "animate-pulse" : ""}`}
              style={fait[i] ? { background: i === SUIVI.length - 1 ? "#059669" : "linear-gradient(135deg,#2b5a8f,#173a5e)" } : undefined}
            >
              {fait[i] ? <Check size={12} strokeWidth={3} /> : i + 1}
            </button>
          </Fragment>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gray-500 truncate">
        {dernier < 0 ? "Rien de coché pour l'instant" : `Dernière étape : ${COURT[dernier]}`}
      </p>
    </div>
  );
}

export default function PraimyCRM({ email }: { email: string }) {
  const { data: allLeads } = useLeads();
  const matchLead = useMemo(() => makeMatcher(allLeads ?? []), [allLeads]);
  const [dossiers, setDossiers] = useState<PraimyDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const syncToPacPac = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const app = await getEspaceProApp();
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const functions = getFunctions(app, "europe-west9");
      const syncFn = httpsCallable<void, { success: boolean; updatedCount: number }>(
        functions,
        "syncPraimyToPacPac"
      );
      const res = await syncFn();
      setSyncResult(`✓ ${res.data.updatedCount} synchro`);
      setTimeout(() => setSyncResult(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Erreur de synchronisation avec Pac Pac.");
    } finally {
      setSyncing(false);
    }
  };

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
    }).sort((a, b) => stepIndex(a.statut) - stepIndex(b.statut) || String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
  }, [dossiers, query, filterStatut]);

  const stats = useMemo(() => {
    const total = dossiers.length;
    const signes = dossiers.filter((d) => d.statut === "signe").length;
    const signatures = dossiers.filter((d) => d.statut === "signature").length;
    const devis = dossiers.filter((d) => d.statut === "devis").length;
    const urgents = dossiers.filter((d) => d.is_urgent).length;
    const bySteps = STEPS.map((st) => ({ ...st, count: dossiers.filter((d) => (d.statut || "").toLowerCase() === st.key).length }));
    const autres = dossiers.filter((d) => stepIndex(d.statut) === STEPS.length).length;
    return { total, signes, signatures, devis, urgents, bySteps, autres };
  }, [dossiers]);

  const attente = dossiers.filter((d) => d.awaiting_me).length;
  const liste = filterStatut === "__attente" ? filtered.filter((d) => d.awaiting_me) : filtered;

  return (
    <div className="max-w-[1900px] mx-auto space-y-3">
      {/* En-tête compact : titre, recherche, actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Nos clients PRAIMY</h1>
          <p className="text-xs text-gray-500">Les clients signés chez PRAIMY : on fait avancer chaque projet jusqu'à l'installation.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Client, ville ou référence…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1f4b7f]"
          />
        </div>
        <button
          onClick={syncToPacPac}
          disabled={syncing || loading}
          title="Recopier les étapes PRAIMY dans Pac Pac"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#1f4b7f] bg-[#edf2f8] rounded-xl hover:bg-[#dde6f1] transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncResult ? syncResult : "Synchro Pac Pac"}
        </button>
        <button
          onClick={() => loadDossiers(true)}
          disabled={loading || refreshing}
          title="Recharger depuis PRAIMY"
          className="inline-flex items-center justify-center w-9 h-9 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
        <a
          href="https://portail.praimy.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition hover:brightness-110"
          style={{ background: "var(--brand-grad-120)" }}
        >
          Portail PRAIMY <ExternalLink size={13} />
        </a>
      </div>

      {/* Parcours compact : une pastille par étape PRAIMY (clic = filtrer) + ce que PRAIMY attend de nous */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilterStatut("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${filterStatut === "all" ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
          style={filterStatut === "all" ? { background: "var(--brand-grad-120)" } : undefined}
        >
          Tous · {stats.total}
        </button>
        {attente > 0 && (
          <button
            onClick={() => setFilterStatut(filterStatut === "__attente" ? "all" : "__attente")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border transition ${filterStatut === "__attente" ? "bg-[#dc2626] text-white border-[#dc2626]" : "bg-red-50 text-[#b91c1c] border-red-200 hover:bg-red-100"}`}
            title="Dossiers où PRAIMY attend une action de notre part"
          >
            ⚠️ PRAIMY attend de nous · {attente}
          </button>
        )}
        <span className="shrink-0 w-px h-5 bg-gray-200 mx-1" />
        {stats.bySteps.map((st, i) => {
          const active = filterStatut === st.key;
          return (
            <button
              key={st.key}
              onClick={() => setFilterStatut(active ? "all" : st.key)}
              disabled={!st.count && !active}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition disabled:opacity-40 ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: st.color }} />
              {i + 1}. {formatStatus(st.key).label}
              <span className={`font-extrabold ${active ? "text-white" : "text-gray-900"}`}>{st.count}</span>
            </button>
          );
        })}
        {stats.urgents > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-[#dc2626] ml-1">
            <Flame size={13} /> {stats.urgents} urgent{stats.urgents > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <p className="text-[11px] text-gray-500">
        <b className="text-gray-700">Avancement :</b> cliquez sur un point quand l'étape est faite —{" "}
        {COURT.map((c, i) => `${i + 1} ${c}`).join(" · ")}
      </p>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <BrandLoader />
          <p className="text-sm text-gray-500 mt-4">Connexion à PRAIMY…</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Erreur avec PRAIMY</p>
            <p className="text-xs mt-1 text-red-600">{error}</p>
            <button onClick={() => loadDossiers()} className="mt-2 text-xs font-semibold text-red-800 underline hover:no-underline">
              Réessayer
            </button>
          </div>
        </div>
      ) : liste.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500">
          <FileCheck2 size={32} className="mx-auto mb-2 text-gray-400" />
          <p className="font-medium text-sm">Aucun dossier</p>
        </div>
      ) : (
        /* Tableau des dossiers : prend toute la hauteur, en-tête collé en haut */
        <div className="bg-white border border-[#e6eaf2] rounded-2xl shadow-sm overflow-auto max-h-[calc(100vh-190px)]">
          <table className="w-full text-left border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wide [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[#f7f9fc] [&>th]:border-b [&>th]:border-[#e6eaf2] [&>th]:py-2.5 [&>th]:px-3">
                <th>Client</th>
                <th>Avancement (nous)</th>
                <th>Prochaine action</th>
                <th>Pré-visite</th>
                <th>Pose</th>
                <th className="text-right">Reste à charge</th>
                <th title="Vert : moins de 6 jours · orange : 6 à 14 jours · rouge : 15 jours et plus">Dernière action</th>
                <th>Étape PRAIMY</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((d, idx) => {
                const badge = formatStatus(d.statut, d.global_status);
                const si = stepIndex(d.statut);
                const newStep = idx === 0 || stepIndex(liste[idx - 1].statut) !== si;
                const color = STEPS[si]?.color ?? "#9ca3af";
                const lead = matchLead(d.reference, d.client_nom);
                const etapes = prochainesEtapes(lead);
                const vt = dateVtOf(lead);
                const pose = datePoseOf(lead);
                const r = relance(derniereAction(d.updated_at, lead));
                return (
                  <Fragment key={d.id}>
                    {newStep && (
                      <tr>
                        <td colSpan={8} className="pt-4 pb-1.5 px-3 border-b border-[#e6eaf2]">
                          <span className="inline-flex items-center gap-2 text-[13px] font-extrabold" style={{ color }}>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                            {si < STEPS.length ? `${si + 1}. ${badge.label}` : "Autres statuts"}
                            <span className="font-semibold text-gray-400 text-xs">{liste.filter((x) => stepIndex(x.statut) === si).length} dossier(s)</span>
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr className="group hover:bg-[#f7f9fc] [&>td]:border-b [&>td]:border-gray-100 [&>td]:py-2.5 [&>td]:px-3 align-middle">
                      <td className="whitespace-nowrap" style={{ boxShadow: `inset 4px 0 0 ${color}` }}>
                        <div className="flex items-center gap-1.5 font-bold text-gray-900">
                          {d.is_urgent && <Flame size={14} className="text-[#dc2626] fill-[#dc2626]" />}
                          {d.client_nom || "Client sans nom"}
                          {lead?.phone && (
                            <a href={`tel:${lead.phone.replace(/\s/g, "")}`} title={`Appeler ${lead.phone}`} className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#edf2f8] text-[#1f4b7f] hover:bg-[#dde6f1]">
                              <Phone size={12} />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-1">
                          <MapPin size={11} /> {d.client_ville || d.ville || "—"}
                        </div>
                      </td>
                      <td>
                        <Avancement lead={lead} email={email} />
                      </td>
                      <td className="min-w-[200px] text-xs">
                        {etapes[0] && (
                          <p className={`font-bold ${etapes[0].startsWith("✅") ? "text-[#059669]" : etapes[0].startsWith("Attendre") ? "text-[#d97706]" : "text-[#1f4b7f]"}`}>
                            {etapes[0].startsWith("✅") ? etapes[0] : `➜ ${etapes[0]}`}
                          </p>
                        )}
                        {etapes.slice(1).map((e) => (
                          <p key={e} className="text-gray-600">➜ {e}</p>
                        ))}
                        {d.next_action_label && (
                          <p className={`mt-0.5 ${d.awaiting_me ? "font-semibold text-[#dc2626]" : "text-gray-400"}`}>
                            {d.awaiting_me ? "⚠️ PRAIMY attend : " : "PRAIMY : "}
                            {d.next_action_label}
                          </p>
                        )}
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {vt ? (
                          <span className="font-semibold text-gray-800">
                            {frCourt(vt)}
                            {lead?.fields.heureVt ? ` · ${lead.fields.heureVt}` : ""}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {pose ? (
                          <span className="font-semibold text-gray-800">
                            {frCourt(pose)}
                            {lead?.fields.heurePose ? ` · ${lead.fields.heurePose}` : ""}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="text-right text-xs font-semibold text-gray-900 whitespace-nowrap">
                        {typeof d.reste_a_charge_ttc === "number" ? `${d.reste_a_charge_ttc.toLocaleString("fr-FR")} €` : "—"}
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {r.jours === null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${r.cls}`}>{r.jours === 0 ? "aujourd'hui" : `il y a ${r.jours} j`}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <a
                          href={`https://portail.praimy.fr/dossiers/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Ouvrir le dossier ${d.reference || ""} chez PRAIMY`}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          {badge.label}
                          {d.is_blocked && <ShieldAlert size={12} className="text-[#dc2626]" />}
                          <ExternalLink size={11} className="text-gray-400" />
                        </a>
                        <div className="mt-0.5 font-mono text-[10px] text-gray-400">{d.reference || d.id.slice(0, 8)}</div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
