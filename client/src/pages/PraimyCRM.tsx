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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link2 } from "lucide-react";
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
// Dossier PRAIMY sans fiche Pac Pac trouvée : on choisit la fiche du client dans une petite liste.
function Relier({ d, leads, email }: { d: PraimyDossier; leads: Lead[]; email: string }) {
  const [q, setQ] = useState((d.client_nom || "").split(/\s+/).filter((w) => w.length > 2).slice(-1)[0] ?? "");
  const [busy, setBusy] = useState(false);
  const norm = (v?: string) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const choix = useMemo(() => {
    const t = norm(q).trim();
    if (t.length < 2) return [];
    return leads.filter((l) => !l.deletedAt && (l.board || "leads") === "leads" && (norm(l.name).includes(t) || String(l.phone ?? "").replace(/\s/g, "").includes(t.replace(/\s/g, "")))).slice(0, 8);
  }, [q, leads]);
  const relier = async (l: Lead) => {
    setBusy(true);
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, "crm_leads", l.id), {
        "fields.refPraimy": String(d.reference || ""),
        crmOwned: true,
        updatedAt: m.serverTimestamp(),
        updatedBy: email,
        notes: m.arrayUnion({ id: Math.random().toString(36).slice(2, 12), text: `Relié au dossier PRAIMY ${d.reference || ""}`, by: email, at: new Date().toISOString(), kind: "statut" }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#9fb4cf] px-2.5 py-1 text-[11px] font-semibold text-[#1f4b7f] hover:bg-[#edf2f8]" title="Ce dossier PRAIMY n'est rattaché à aucun client de Pac Pac : choisissez le bon client pour suivre son avancement ici">
          <Link2 size={12} /> Choisir le client dans Pac Pac
        </button>
      </PopoverTrigger>
      <PopoverContent dir="ltr" align="start" className="w-72 p-2 bg-white shadow-xl border border-[#e6eaf2]">
        <p className="px-1 pb-1.5 text-xs text-gray-600">
          Quel client de Pac Pac correspond à <b>{d.client_nom || "ce dossier"}</b> ?
        </p>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou téléphone…" className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#1f4b7f]" />
        <div className="mt-1 max-h-60 overflow-auto">
          {choix.map((l) => (
            <button key={l.id} disabled={busy} onClick={() => relier(l)} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-[#edf2f8] disabled:opacity-50">
              <p className="text-sm font-semibold text-gray-900">{l.name}</p>
              <p className="text-[11px] text-gray-500">{[l.phone, l.fields?.ville || l.fields?.city].filter(Boolean).join(" · ") || "—"}</p>
            </button>
          ))}
          {q.trim().length >= 2 && !choix.length && <p className="px-2 py-2 text-xs text-gray-400">Aucun client trouvé.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Avancement({ lead, email, dossier, leads }: { lead: Lead | null; email: string; dossier: PraimyDossier; leads: Lead[] }) {
  const [busy, setBusy] = useState("");
  if (!lead) return <Relier d={dossier} leads={leads} email={email} />;
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
  const nb = fait.filter(Boolean).length;
  const fini = fait[SUIVI.length - 1];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="group/av w-[190px] text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-[#edf2f8] transition" title="Voir et cocher les étapes">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(nb / SUIVI.length) * 100}%`, background: fini ? "#059669" : "linear-gradient(90deg,#2b5a8f,#173a5e)" }} />
            </div>
            <span className="text-[11px] font-extrabold text-gray-700 tabular-nums">{nb}/{SUIVI.length}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500 truncate group-hover/av:text-[#1f4b7f]">
            {dernier < 0 ? "Rien de fait · cliquer pour cocher" : `Fait : ${COURT[dernier]}`}
          </p>
        </button>
      </PopoverTrigger>
      <PopoverContent dir="ltr" align="start" className="w-64 p-2 bg-white shadow-xl border border-[#e6eaf2]">
        <p className="px-1 pb-1 text-xs font-bold text-gray-700">Cochez ce qui est fait</p>
        {SUIVI.map((o, i) => (
          <button
            key={o.key}
            onClick={() => toggle(o.key)}
            disabled={!!busy}
            className="w-full flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-[#edf2f8] disabled:opacity-60"
          >
            <span className={`h-5 w-5 shrink-0 rounded-md flex items-center justify-center ${fait[i] ? "bg-[#1f4b7f] text-white" : "border-2 border-gray-300"} ${busy === o.key ? "animate-pulse" : ""}`}>
              {fait[i] && <Check size={13} strokeWidth={3} />}
            </span>
            <span className={fait[i] ? "text-gray-900 font-semibold" : "text-gray-600"}>{o.label.replace(/^\d+\.\s*/, "")}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Groupes du tableau : ce qu'il faut faire pour le client (le plus urgent en haut).
// Couleurs : rouge = urgent, bleu = à nous d'agir, ambre = on attend, vert = ok, gris = à ranger.
const A_FAIRE: { k: string; titre: string; couleur: string }[] = [
  { k: "attente", titre: "⚠️ PRAIMY attend quelque chose de nous", couleur: "#dc2626" },
  { k: "propal", titre: "Proposition à envoyer ou à faire signer", couleur: "#1f4b7f" },
  { k: "mpr", titre: "Demande MaPrimeRénov' à faire", couleur: "#1f4b7f" },
  { k: "vt", titre: "Pré-visite à programmer", couleur: "#1f4b7f" },
  { k: "pose", titre: "Installation à programmer", couleur: "#1f4b7f" },
  { k: "attendre", titre: "On attend l'accord MaPrimeRénov'", couleur: "#d97706" },
  { k: "suivre", titre: "Installation calée : suivre la pose", couleur: "#059669" },
  { k: "fini", titre: "✅ Installés", couleur: "#059669" },
  { k: "relier", titre: "Client à choisir dans Pac Pac", couleur: "#7f8794" },
];
function aFaire(d: PraimyDossier, lead: Lead | null): number {
  const k = (() => {
    if (d.awaiting_me) return "attente";
    if (!lead) return "relier";
    const e = prochainesEtapes(lead)[0] ?? "";
    if (e.startsWith("✅")) return "fini";
    if (/proposition|signature/i.test(e)) return "propal";
    if (/demande MaPrimeR/i.test(e)) return "mpr";
    if (/pré-visite/i.test(e)) return "vt";
    if (/^Attendre/i.test(e)) return "attendre";
    if (/installation/i.test(e)) return "pose";
    return "suivre";
  })();
  return A_FAIRE.findIndex((g) => g.k === k);
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
  // « Mettre à jour » : recharge les dossiers PRAIMY et recopie leurs étapes dans Pac Pac, en un seul bouton.
  const mettreAJour = () => {
    loadDossiers(true);
    syncToPacPac();
  };
  const syncToPacPac = async () => {
    try {
      const app = await getEspaceProApp();
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const functions = getFunctions(app, "europe-west9");
      const syncFn = httpsCallable<void, { success: boolean; updatedCount: number }>(
        functions,
        "syncPraimyToPacPac"
      );
      await syncFn();
    } catch (err: any) {
      console.error(err);
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
        filterStatut.startsWith("__") ||
        d.statut?.toLowerCase() === filterStatut.toLowerCase() ||
        d.global_status?.toLowerCase() === filterStatut.toLowerCase();

      return matchQuery && matchStatut;
    })
      .map((d) => ({ d, g: aFaire(d, matchLead(d.reference, d.client_nom)) }))
      .sort((a, b) => a.g - b.g || String(b.d.updated_at ?? "").localeCompare(String(a.d.updated_at ?? "")))
      .map((x) => x.d);
  }, [dossiers, query, filterStatut, matchLead]);

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
  const aRelier = dossiers.filter((d) => !matchLead(d.reference, d.client_nom)).length;
  const liste = filterStatut === "__attente" ? filtered.filter((d) => d.awaiting_me) : filterStatut === "__relier" ? filtered.filter((d) => !matchLead(d.reference, d.client_nom)) : filtered;

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
          onClick={mettreAJour}
          disabled={loading || refreshing}
          title="Recharger les dossiers depuis PRAIMY et recopier leurs étapes dans Pac Pac"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#1f4b7f] bg-[#edf2f8] rounded-xl hover:bg-[#dde6f1] transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Mettre à jour
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

      {/* 3 filtres simples ; les étapes PRAIMY sont les titres de groupes dans le tableau */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {(
          [
            ["all", `Tous les dossiers · ${stats.total}`, true],
            ["__attente", `⚠️ PRAIMY attend de nous · ${attente}`, attente > 0],
            ["__relier", `🔗 Client à choisir · ${aRelier}`, aRelier > 0],
          ] as [string, string, boolean][]
        )
          .filter(([, , voir]) => voir || false)
          .map(([k, l]) => {
            const on = filterStatut === k;
            const rouge = k === "__attente";
            return (
              <button
                key={k}
                onClick={() => setFilterStatut(on && k !== "all" ? "all" : k)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                  on ? (rouge ? "bg-[#dc2626] text-white border-[#dc2626]" : "text-white border-transparent shadow-sm") : rouge ? "bg-red-50 text-[#b91c1c] border-red-200 hover:bg-red-100" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
                style={on && !rouge ? { background: "var(--brand-grad-120)" } : undefined}
              >
                {l}
              </button>
            );
          })}
      </div>

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
                <th>Avancement</th>
                <th>À savoir</th>
                <th>Pré-visite</th>
                <th>Pose</th>
                <th className="text-right">Reste à charge</th>
                <th title="Vert : moins de 6 jours · orange : 6 à 14 jours · rouge : 15 jours et plus">Dernière action</th>
                <th>Chez PRAIMY</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((d, idx) => {
                const badge = formatStatus(d.statut, d.global_status);
                const si = stepIndex(d.statut);
                const lead = matchLead(d.reference, d.client_nom);
                const gi = aFaire(d, lead);
                const groupe = A_FAIRE[gi];
                const newStep = idx === 0 || aFaire(liste[idx - 1], matchLead(liste[idx - 1].reference, liste[idx - 1].client_nom)) !== gi;
                const color = STEPS[si]?.color ?? "#9ca3af";
                const etapes = prochainesEtapes(lead);
                const vt = dateVtOf(lead);
                const pose = datePoseOf(lead);
                const r = relance(derniereAction(d.updated_at, lead));
                return (
                  <Fragment key={d.id}>
                    {newStep && (
                      <tr>
                        <td colSpan={8} className="pt-4 pb-1.5 px-3 border-b border-[#e6eaf2]">
                          <span className="inline-flex items-center gap-2 text-[14px] font-extrabold" style={{ color: groupe.couleur }}>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: groupe.couleur }} />
                            {groupe.titre}
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-600 text-[11px]">
                              {liste.filter((x) => aFaire(x, matchLead(x.reference, x.client_nom)) === gi).length}
                            </span>
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr className="group hover:bg-[#f7f9fc] [&>td]:border-b [&>td]:border-gray-100 [&>td]:py-2.5 [&>td]:px-3 align-middle">
                      <td className="whitespace-nowrap" style={{ boxShadow: `inset 4px 0 0 ${groupe.couleur}` }}>
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
                        <Avancement lead={lead} email={email} dossier={d} leads={allLeads ?? []} />
                      </td>
                      <td className="min-w-[200px] max-w-[320px] text-xs">
                        {d.next_action_label && (
                          <p className={d.awaiting_me ? "font-semibold text-[#dc2626]" : "text-gray-600"}>
                            {d.awaiting_me ? "PRAIMY attend : " : "PRAIMY : "}
                            {d.next_action_label}
                          </p>
                        )}
                        {etapes.slice(gi === 0 ? 0 : 1).filter((e) => !e.startsWith("✅")).map((e) => (
                          <p key={e} className="text-[#1f4b7f]">➜ {e}</p>
                        ))}
                        {!d.next_action_label && etapes.length <= (gi === 0 ? 0 : 1) && <span className="text-gray-300">—</span>}
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
