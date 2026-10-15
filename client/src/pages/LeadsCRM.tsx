import BrandLoader from "@/components/BrandLoader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Phone,
  MessageCircle,
  Mail,
  Search,
  Plus,
  ZoomIn,
  ZoomOut,
  Loader2,
  BellRing,
  Check,
  X,
  Send,
  Paperclip,
  Trash2,
  Upload,
  FileText,
  ExternalLink,
  SendHorizonal,
  Filter,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import LeadChat from "./LeadChat";
import ClientSpaceDashboard from "./ClientSpaceDashboard";
import { buildClientView } from "@/lib/clientSpace";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { crmFirestore } from "@/lib/crmDb";
import { getEspaceProApp } from "@/lib/espacePro";
import { useLeads } from "@/lib/crmStore";
import { LEAD_COLUMNS, cellValue, formulaValue, type ColType, type LeadColumn } from "@/lib/crmColumns";
import { useColumnsConfig } from "@/lib/crmColumnsConfig";
import ColumnMenu from "./ColumnMenu";
import { PersonBar } from "./LeadsFilter";
import { AddSplit, GroupByMenu, MoreMenu, QuickFilter, SearchToggle, SortMenu } from "./LeadsToolbar";
import { applyFilters, groupByColumn, leadMatchesPerson, leadsToCsv, sortLeads, type LeadFilter, type LeadSort, type Person } from "@/lib/crmFilters";
import { ROOT_ADMINS, memberName } from "@/lib/crmTeam";
import LeadsTable, { ColumnsMenu, StatusEditContext, useVisibleColumns } from "./LeadsTable";
import { useIsMobile } from "@/hooks/use-mobile";
import DocumentsPanel from "./DocumentsPanel";
import {
  CRM_BOARDS_COLLECTION,
  CRM_LEADS_COLLECTION,
  DEFAULT_LEAD_GROUPS,
  LEADS_BOARD_ID,
  type LeadGroup,
  LEAD_STATUSES,
  LEAD_TYPES,
  TYPE_BADGE,
  formatDateTime,
  formatPhone,
  formatShortDate,
  formatYmd,
  leadFromDoc,
  statusInfo,
  isClosedStatus,
  groupOf,
  telHref,
  todayYmd,
  whatsappHref,
  type Lead,
  type LeadNote,
  type LeadStatus,
  type LeadType,
} from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// Onglet Leads — CRM maison (étape 1 du remplacement de Monday).
// Données : collection Firestore crm_leads, lue en temps réel avec la session
// Google de l'Espace Pro (règles Firestore : e-mails autorisés uniquement).
// Deux vues (liste / colonnes par statut), recherche, filtres, et une fiche
// avec notes, rappel, boutons appeler / WhatsApp / mail.
// ─────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50; // leads affichés par "Afficher plus" (liste)
const COLUMN_SIZE = 30; // leads affichés par colonne (vue colonnes)

const newId = () => Math.random().toString(36).slice(2, 10);

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const fs = crmFirestore;

async function patchLead(
  id: string,
  email: string,
  patch: Record<string, unknown>,
) {
  const { m, db } = await fs();
  await m.updateDoc(m.doc(db, CRM_LEADS_COLLECTION, id), {
    ...patch,
    updatedAt: m.serverTimestamp(),
    updatedBy: email,
  });
}

async function addLeadNote(id: string, email: string, note: LeadNote) {
  const { m } = await fs();
  await patchLead(id, email, { notes: m.arrayUnion(note) });
}

// ── Pastilles ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: LeadStatus }) => {
  const s = statusInfo(status);
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap text-white"
      style={{ background: s.hex }}
    >
      {s.label || "—"}
    </span>
  );
};

const TypeBadge = ({ type }: { type: LeadType }) => (
  <span
    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[type] ?? TYPE_BADGE.Autre}`}
  >
    {type}
  </span>
);

const isOverdue = (l: Lead) =>
  !!l.rappelLe && l.rappelLe <= todayYmd() && !isClosedStatus(l.status);

const RappelTag = ({ lead }: { lead: Lead }) =>
  lead.rappelLe ? (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
        isOverdue(lead) ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
      }`}
    >
      <BellRing size={10} /> {formatYmd(lead.rappelLe).slice(0, 5)}
    </span>
  ) : null;

// Boutons rapides (appeler / WhatsApp) : ne déclenchent pas l'ouverture de la fiche.
const QuickActions = ({ lead }: { lead: Lead }) => {
  const tel = telHref(lead.phone);
  const wa = whatsappHref(lead.phone);
  if (!tel) return null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className="flex gap-1.5 shrink-0" onClick={stop}>
      <a
        href={tel}
        aria-label={`Appeler ${lead.name}`}
        className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-[#2b5a8f] text-white"
      >
        <Phone size={14} />
      </a>
      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        aria-label={`WhatsApp ${lead.name}`}
        className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-green-500 text-white"
      >
        <MessageCircle size={14} />
      </a>
    </div>
  );
};

// ── Carte (liste et colonnes) ──────────────────────────────────────────────
const LeadCard = ({
  lead,
  onOpen,
  compact,
  draggable,
}: {
  lead: Lead;
  onOpen: () => void;
  compact?: boolean;
  draggable?: boolean;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(e) => e.key === "Enter" && onOpen()}
    draggable={draggable}
    onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm text-left cursor-pointer hover:border-[#2b5a8f]/40 transition-colors ${
      compact ? "p-3" : "p-4"
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-bold text-gray-900 truncate">{lead.name || "Sans nom"}</p>
        <p className="text-xs text-gray-500 truncate">
          {[lead.phone && formatPhone(lead.phone), lead.postalCode || lead.city]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <QuickActions lead={lead} />
    </div>
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {!compact && <StatusBadge status={lead.status} />}
      <TypeBadge type={lead.type} />
      <RappelTag lead={lead} />
      <span className="ml-auto text-[11px] text-gray-400">
        {formatShortDate(lead.createdAt)}
      </span>
    </div>
  </div>
);

// ── Fiche lead ─────────────────────────────────────────────────────────────
const inputCls =
  "w-full text-base sm:text-sm bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#2b5a8f]";

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
    {children}
  </label>
);

// ── Envoi de mail / SMS (fonction sendLeadMessage) ─────────────────────────
type MsgTemplate = { key: string; subject: string; sms: string };

async function callFn<T>(name: string, data?: unknown): Promise<T> {
  const app = await getEspaceProApp();
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const fn = httpsCallable(getFunctions(app, "europe-west9"), name);
  return (await fn(data)).data as T;
}

const MessageSender = ({ lead }: { lead: Lead }) => {
  const [templates, setTemplates] = useState<MsgTemplate[] | null>(null);
  const [tplKey, setTplKey] = useState("");
  const [sms, setSms] = useState("");
  const [sending, setSending] = useState<"" | "mail" | "sms">("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    callFn<{ templates: MsgTemplate[] }>("listLeadTemplates")
      .then((r) => setTemplates(r.templates))
      .catch((e) => {
        console.error(e);
        setTemplates([]);
        setFeedback({ ok: false, text: "Modèles indisponibles (fonction non déployée ?)." });
      });
  }, []);

  const pick = (key: string) => {
    setTplKey(key);
    setFeedback(null);
    const t = templates?.find((x) => x.key === key);
    if (t) setSms(t.sms);
  };

  const send = async (channel: "mail" | "sms") => {
    const what = channel === "mail" ? `le mail à ${lead.email}` : `le SMS au ${formatPhone(lead.phone)}`;
    if (!confirm(`Envoyer ${what} ?`)) return;
    setSending(channel);
    setFeedback(null);
    try {
      await callFn("sendLeadMessage", {
        leadId: lead.id,
        channel,
        template: tplKey || undefined,
        text: channel === "sms" ? sms : undefined,
      });
      setFeedback({ ok: true, text: channel === "mail" ? "Mail envoyé." : "SMS envoyé." });
    } catch (e: any) {
      console.error(e);
      setFeedback({ ok: false, text: e?.message || "Échec de l'envoi." });
    } finally {
      setSending("");
    }
  };

  return (
    <div className="pt-3 border-t border-gray-100 space-y-2">
      <span className="block text-xs font-semibold text-gray-600">Envoyer un message</span>
      <select value={tplKey} onChange={(e) => pick(e.target.value)} className={inputCls}>
        <option value="">Modèle…</option>
        {templates?.map((t) => (
          <option key={t.key} value={t.key}>
            {t.key}
          </option>
        ))}
      </select>
      <textarea
        value={sms}
        onChange={(e) => setSms(e.target.value)}
        rows={3}
        maxLength={480}
        placeholder="Texte du SMS (choisissez un modèle ou écrivez un message libre)"
        className={`${inputCls} resize-none`}
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => send("mail")}
          disabled={!tplKey || !lead.email || !!sending}
          title={!lead.email ? "Pas d'adresse e-mail" : undefined}
          className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300 rounded-xl py-2.5"
        >
          {sending === "mail" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          Envoyer le mail
        </button>
        <button
          onClick={() => send("sms")}
          disabled={!sms.trim() || !lead.phone || !!sending}
          title={!lead.phone ? "Pas de téléphone" : undefined}
          className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-green-600 disabled:bg-gray-300 rounded-xl py-2.5"
        >
          {sending === "sms" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Envoyer le SMS
        </button>
      </div>
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-green-600" : "text-red-600"}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
};

type Draft = {
  name: string;
  phone: string;
  email: string;
  postalCode: string;
  city: string;
  type: LeadType;
  projet: string;
};

const draftOf = (l?: Lead): Draft => ({
  name: l?.name ?? "",
  phone: l?.phone ?? "",
  email: l?.email ?? "",
  postalCode: l?.postalCode ?? "",
  city: l?.city ?? "",
  type: l?.type ?? "PAC",
  projet: l?.projet ?? "",
});

const LeadSheet = ({
  lead,
  creating,
  email,
  onClose,
  focusUpdates,
  boardId = LEADS_BOARD_ID,
}: {
  boardId?: string;
  focusUpdates?: boolean;
  lead: Lead | null;
  creating: boolean;
  email: string;
  onClose: () => void;
}) => {
  const open = creating || !!lead;
  const [draft, setDraft] = useState<Draft>(draftOf(lead ?? undefined));
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewSpace, setPreviewSpace] = useState(false);
  const [error, setError] = useState("");
  const [praimyBusy, setPraimyBusy] = useState(false);
  const [praimySuccess, setPraimySuccess] = useState(false);

  const sendToPraimy = async () => {
    if (!lead) return;
    setPraimyBusy(true);
    setError("");
    try {
      const app = await getEspaceProApp();
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const functions = getFunctions(app, "europe-west9");
      const exportFn = httpsCallable<{ leadId: string }, { success: boolean; clientId: string }>(
        functions,
        "exportLeadToPraimy"
      );
      await exportFn({ leadId: lead.id });
      setPraimySuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Erreur lors du transfert à PRAIMY.");
    } finally {
      setPraimyBusy(false);
    }
  };

  // Ouverte depuis la bulle de la ligne : on descend directement aux mises à jour.
  useEffect(() => {
    if (!focusUpdates || !lead) return;
    const t = setTimeout(() => document.getElementById("updates-section")?.scrollIntoView({ block: "start" }), 450);
    return () => clearTimeout(t);
  }, [lead?.id, focusUpdates]);

  // Ouvrir la fiche = lire le mail reçu : le repère disparaît du tableau.
  useEffect(() => {
    if (lead?.mailNonLu) patchLead(lead.id, email, { mailNonLu: false }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, lead?.mailNonLu]);

  // Recharge le brouillon quand on ouvre une autre fiche.
  const leadId = lead?.id;
  useEffect(() => {
    setDraft(draftOf(lead ?? undefined));
    setNoteText("");
    setError("");
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, creating]);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }) as Draft);

  const dirty = creating
    ? true
    : lead
      ? (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== draftOf(lead)[k])
      : false;

  const run = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError(fail);
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = () =>
    run(async () => {
      if (!draft.name.trim() && !draft.phone.trim()) {
        throw new Error("nom ou téléphone requis");
      }
      const clean = {
        ...draft,
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim().toLowerCase(),
        postalCode: draft.postalCode.trim(),
        city: draft.city.trim(),
        projet: draft.projet.trim(),
      };
      if (creating) {
        const { m, db } = await fs();
        await m.addDoc(m.collection(db, CRM_LEADS_COLLECTION), {
          ...clean,
          board: boardId,
          source: "saisie-manuelle",
          status: "nouveau_lead",
          group: DEFAULT_LEAD_GROUPS[0].id,
          rappelLe: "",
          details: {},
          notes: [],
          createdAt: m.serverTimestamp(),
          updatedAt: m.serverTimestamp(),
          updatedBy: email,
        });
        onClose();
      } else if (lead) {
        const { m } = await fs();
        const before = draftOf(lead);
        const labels: Record<string, string> = { name: "Nom", phone: "Téléphone", email: "E-mail", postalCode: "Code postal", city: "Ville", type: "Type", projet: "Projet" };
        const traces = (Object.keys(labels) as (keyof Draft)[])
          .filter((k) => String(before[k] ?? "") !== String(clean[k] ?? ""))
          .map((k) => ({
            id: newId(),
            text: `${labels[k]} : ${before[k] || "vide"} → ${clean[k] || "vide"}`,
            by: email,
            at: new Date().toISOString(),
            kind: "statut" as const,
          }));
        await patchLead(lead.id, email, traces.length ? { ...clean, notes: m.arrayUnion(...traces) } : clean);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    }, "Échec de l'enregistrement (nom ou téléphone requis). Réessayez.");

  const changeStatus = (status: LeadStatus) => {
    if (!lead || status === lead.status) return;
    const trace: LeadNote = {
      id: newId(),
      text: `${statusInfo(lead.status).label} → ${statusInfo(status).label}`,
      by: email,
      at: new Date().toISOString(),
      kind: "statut",
    };
    run(async () => {
      const { m } = await fs();
      await patchLead(lead.id, email, { status, notes: m.arrayUnion(trace) });
    }, "Impossible de changer le statut.");
  };

  const changeRappel = (rappelLe: string) =>
    lead &&
    run(async () => {
      const { m } = await fs();
      await patchLead(lead.id, email, {
        rappelLe,
        notes: m.arrayUnion({
          id: newId(),
          text: `Rappel : ${lead.rappelLe || "vide"} → ${rappelLe || "vide"}`,
          by: email,
          at: new Date().toISOString(),
          kind: "statut",
        } satisfies LeadNote),
      });
    }, "Impossible d'enregistrer le rappel.");

  const addNote = () => {
    const text = noteText.trim();
    if (!lead || !text) return;
    // La mise à jour est enregistrée par la fonction postUpdate, qui prévient
    // aussi toute l'équipe par e-mail.
    run(async () => {
      await callFn("postUpdate", { kind: "lead", id: lead.id, text });
      setNoteText("");
    }, "Impossible d'ajouter la mise à jour.");
  };

  const tel = lead ? telHref(lead.phone) : "";
  const detailEntries = lead ? Object.entries(lead.details).filter(([, v]) => v) : [];
  const notes = lead ? [...lead.notes].sort((a, b) => (a.at < b.at ? 1 : -1)) : [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto" dir="ltr">
        <SheetHeader className="text-left">
          <SheetTitle>{creating ? "Nouveau lead" : lead?.name || "Fiche lead"}</SheetTitle>
          <SheetDescription>
            {creating
              ? "Saisie manuelle d'un contact."
              : lead
                ? `Reçu le ${formatDateTime(lead.createdAt)}${lead.source ? ` · ${lead.source}` : ""}`
                : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {lead && (
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              {tel && (
                <a
                  href={tel}
                  className="inline-flex items-center justify-center gap-1.5 bg-[#2b5a8f] text-white text-sm font-bold px-3 py-2.5 rounded-xl shadow-sm active:scale-95 transition"
                >
                  <Phone size={15} /> Appeler
                </a>
              )}
              {tel && (
                <a
                  href={whatsappHref(lead.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 bg-[#25D366] text-white text-sm font-bold px-3 py-2.5 rounded-xl shadow-sm active:scale-95 transition"
                >
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center justify-center gap-1.5 bg-gray-100 text-gray-800 text-sm font-bold px-3 py-2.5 rounded-xl hover:bg-gray-200 transition"
                >
                  <Mail size={15} /> Mail
                </a>
              )}
              <button
                type="button"
                onClick={sendToPraimy}
                disabled={praimyBusy || praimySuccess || !!lead.praimyClientId}
                className={`inline-flex items-center justify-center gap-1.5 text-sm font-bold px-3 py-2.5 rounded-xl transition ${
                  praimySuccess || lead.praimyClientId
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                    : "bg-[#0f2b4a] text-white hover:bg-[#1a3d66] disabled:opacity-50"
                }`}
              >
                {praimyBusy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : praimySuccess || lead.praimyClientId ? (
                  <Check size={15} className="text-emerald-600" />
                ) : (
                  <SendHorizonal size={15} />
                )}
                {praimySuccess || lead.praimyClientId ? "Envoyé à PRAIMY" : "Envoyer à PRAIMY"}
              </button>
            </div>
          )}

          {lead && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Statut">
                <select
                  value={lead.status}
                  disabled={busy}
                  onChange={(e) => changeStatus(e.target.value as LeadStatus)}
                  className={inputCls}
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label || "(vide)"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="À rappeler le">
                <input
                  type="date"
                  value={lead.rappelLe}
                  disabled={busy}
                  onChange={(e) => changeRappel(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          <div className="space-y-3">
            <Field label="Nom">
              <input value={draft.name} onChange={set("name")} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone">
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={set("phone")}
                  className={inputCls}
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={draft.email}
                  onChange={set("email")}
                  className={inputCls}
                />
              </Field>
              <Field label="Code postal">
                <input
                  value={draft.postalCode}
                  onChange={set("postalCode")}
                  className={inputCls}
                />
              </Field>
              <Field label="Ville">
                <input value={draft.city} onChange={set("city")} className={inputCls} />
              </Field>
              <Field label="Type de lead">
                <select value={draft.type} onChange={set("type")} className={inputCls}>
                  {LEAD_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Projet">
                <input value={draft.projet} onChange={set("projet")} className={inputCls} />
              </Field>
            </div>
            <button
              onClick={saveDraft}
              disabled={!dirty || busy}
              className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-[#2b5a8f] disabled:bg-gray-300 rounded-xl py-2.5"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                <Check size={14} />
              ) : null}
              {creating ? "Créer le lead" : saved ? "Enregistré" : "Enregistrer les infos"}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {lead && (
            <details className="bg-gray-50 rounded-xl p-3 text-xs">
              <summary className="font-semibold text-gray-600 cursor-pointer">Toutes les colonnes (comme Monday)</summary>
              <dl className="mt-2 space-y-1">
                {LEAD_COLUMNS.filter((c) => !["name", "files", "autodate"].includes(c.type)).map((c) => {
                  const v = c.type === "formula" ? formulaValue(lead, c) : c.key === "status" ? statusInfo(lead.status).label : cellValue(lead, c);
                  return v ? (
                    <div key={c.key} className="flex justify-between gap-3">
                      <dt className="text-gray-400">{c.title}</dt>
                      <dd className="font-semibold text-gray-700 text-right">{v}</dd>
                    </div>
                  ) : null;
                })}
              </dl>
            </details>
          )}

          {detailEntries.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs bg-gray-50 rounded-xl p-3">
              {detailEntries.map(([k, v]) => (
                <div key={k}>
                  <dt className="inline text-gray-400">{k} : </dt>
                  <dd className="inline font-semibold text-gray-700">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {lead && (
            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={() => setPreviewSpace(true)}
                className="w-full text-sm font-bold text-[#2b5a8f] border-2 border-[#2b5a8f]/40 hover:bg-blue-50 rounded-xl py-2"
              >
                👁 Aperçu de l'espace client (ce que verra ce client)
              </button>
              {previewSpace && (
                <Dialog open onOpenChange={(o) => !o && setPreviewSpace(false)}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-50 text-slate-900">
                    <DialogTitle className="sr-only">Aperçu de l'espace client</DialogTitle>
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                      Aperçu interne : l'espace client n'est pas encore ouvert aux clients.
                    </p>
                    <ClientSpaceDashboard view={buildClientView(lead)} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}

          {lead && <MessageSender key={lead.id} lead={lead} />}

          {lead && (
            <DocumentsPanel
              key={lead.id}
              ownerType="lead"
              ownerId={lead.id}
              ownerName={lead.name}
              email={email}
              stored={{ docCount: lead.docCount, docCats: lead.docCats }}
              onSummary={(sm) => patchLead(lead.id, email, sm).catch(console.error)}
            />
          )}

          {lead && (
            <div id="updates-section" className="pt-3 border-t border-gray-100">
              <span className="block text-xs font-semibold text-gray-600 mb-2">
                Mises à jour et historique (toute l'équipe est prévenue par e-mail)
              </span>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Résumé de l'appel, prochaine étape…"
                className={`${inputCls} resize-none`}
              />
              <button
                onClick={addNote}
                disabled={!noteText.trim() || busy}
                className="mt-2 w-full text-sm font-bold text-[#2b5a8f] border-2 border-[#2b5a8f] disabled:opacity-40 rounded-xl py-2"
              >
                Ajouter la note
              </button>
              <ul className="mt-3 space-y-2">
                {notes.length === 0 && (
                  <li className="text-xs text-gray-400">Aucune note pour l'instant.</li>
                )}
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      n.kind === "statut"
                        ? "bg-gray-50 text-gray-500 text-xs"
                        : n.kind === "message"
                          ? "bg-green-50 text-gray-700"
                          : n.kind === "mail"
                            ? "bg-indigo-50 text-gray-800 border-l-4 border-indigo-300"
                            : "bg-blue-50 text-gray-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{n.text}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatDateTime(n.at)} · {n.by}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Barre d'outils flottante en bas façon Monday mobile app
const MobileBottomBar = ({
  query,
  onQueryChange,
  zoom,
  onChangeZoom,
  onAddLead,
  filters,
  onFilters,
  leads,
  saveView,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  zoom: number;
  onChangeZoom: (z: number) => void;
  onAddLead: () => void;
  filters: LeadFilter[];
  onFilters: (f: LeadFilter[]) => void;
  leads: Lead[];
  saveView: (name: string) => void;
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  return (
    <div className="md:hidden fixed bottom-3 inset-x-0 z-40 flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-gray-200/90 p-1.5 flex items-center gap-1.5 transition-all">
        {searchOpen ? (
          <div className="flex-1 flex items-center gap-1.5 bg-gray-100 rounded-xl px-2.5 py-1.5">
            <Search size={15} className="text-[#0073ea] shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Rechercher nom, tél, ville…"
              className="w-full text-base bg-transparent outline-none placeholder:text-gray-400"
            />
            {query && (
              <button onClick={() => onQueryChange("")} className="text-gray-400 hover:text-gray-700 p-0.5">
                <X size={14} />
              </button>
            )}
            <button
              onClick={() => setSearchOpen(false)}
              className="text-xs font-bold text-[#0073ea] px-1"
            >
              OK
            </button>
          </div>
        ) : (
          <>
            {/* Bouton recherche façon Monday */}
            <button
              onClick={() => setSearchOpen(true)}
              className={`flex-1 flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition text-left min-w-0 ${
                query ? "bg-blue-50 text-[#0073ea] font-semibold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-[#0073ea] text-white flex items-center justify-center shrink-0 shadow-sm">
                <Search size={12} strokeWidth={2.5} />
              </span>
              <span className="text-xs truncate">{query ? query : "Recherche…"}</span>
            </button>

            {/* Contrôle de zoom immédiat (+ / -) */}
            <div className="flex items-center rounded-xl bg-gray-100 border border-gray-200/70 p-0.5 shrink-0">
              <button
                onClick={() => onChangeZoom(zoom - 0.08)}
                title="Dézoomer"
                className="w-7 h-7 flex items-center justify-center text-gray-700 active:scale-95 text-base font-bold hover:bg-gray-200 rounded-lg"
              >
                −
              </button>
              <button
                onClick={() => onChangeZoom(0.75)}
                title="Taille optimale (75%)"
                className="px-1 text-[11px] font-bold text-gray-700 min-w-[2.4rem] text-center active:scale-95"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => onChangeZoom(zoom + 0.08)}
                title="Zoomer"
                className="w-7 h-7 flex items-center justify-center text-gray-700 active:scale-95 text-base font-bold hover:bg-gray-200 rounded-lg"
              >
                +
              </button>
            </div>

            {/* Filtres rapides */}
            <QuickFilter
              leads={leads}
              filters={filters}
              onFilters={onFilters}
              onSaveView={saveView}
              trigger={
                <button
                  title="Filtres"
                  className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition shrink-0 ${
                    filters.length > 0 ? "bg-[#0073ea] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Filter size={15} />
                  {filters.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                      {filters.length}
                    </span>
                  )}
                </button>
              }
            />

            {/* Bouton Nouveau Lead (+) */}
            <button
              onClick={onAddLead}
              title="Ajouter un lead"
              className="w-8 h-8 rounded-xl bg-[#0073ea] hover:bg-[#0060c2] text-white flex items-center justify-center shrink-0 shadow-sm active:scale-95 transition"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────
export default function LeadsCRM({
  email,
  boardView,
  boardId = LEADS_BOARD_ID,
  onBoardViewChange,
}: {
  // Tableau de leads à part (créé depuis le menu) ; par défaut Pac Pac.
  boardId?: string;
  email: string;
  // Tableau « vue » ouvert depuis le menu : filtres, tri, groupement et colonnes enregistrés.
  boardView?: { filters: LeadFilter[]; sorts: LeadSort[]; groupBy: string; personKey: string; visible: string[] };
  onBoardViewChange?: (v: { filters: LeadFilter[]; sorts: LeadSort[]; groupBy: string; personKey: string; visible: string[] }) => void;
}) {
  const { data: allLeads, error: storeError } = useLeads();
  const leads = useMemo(
    () => (allLeads ? allLeads.filter((l) => (l.board || LEADS_BOARD_ID) === boardId) : allLeads),
    [allLeads, boardId],
  );
  // Ouverture d'une fiche demandée depuis l'Accueil.
  useEffect(() => {
    try {
      const id = sessionStorage.getItem("crm-open-lead");
      if (id) {
        sessionStorage.removeItem("crm-open-lead");
        setTimeout(() => setOpenId(id), 0);
      }
    } catch {}
  }, []);
  const [localError, setError] = useState("");
  const error = localError || storeError;
  // Une seule présentation : le tableau (les vues Liste et Colonnes ne sont plus proposées).
  const [view, setView] = useState<"tableau" | "liste" | "colonnes">("tableau");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | LeadStatus>("");
  // Personnes proposées dans le filtre « Personne » : l'équipe + les commerciaux de Monday.
  const people: Person[] = useMemo(() => {
    const team = Object.entries(ROOT_ADMINS).map(([mail, name]) => ({ key: mail, label: name, emails: [mail] }));
    const extra = ["Mebarek", "Julien"].map((n) => ({ key: n.toLowerCase(), label: n, emails: [] as string[] }));
    return [...team, ...extra];
  }, []);
  const [filters, setFilters] = useState<LeadFilter[]>(boardView?.filters ?? []);
  const [personKey, setPersonKey] = useState(boardView?.personKey ?? "");
  const [sorts, setSorts] = useState<LeadSort[]>(boardView?.sorts ?? []);
  const [groupBy, setGroupBy] = useState(boardView?.groupBy ?? "");
  const [rappelsOnly, setRappelsOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusUpdates, setFocusUpdates] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dropOver, setDropOver] = useState<string | null>(null);
  const { version: columnsVersion, api: columnsApi, error: columnsError, ready: columnsReady } = useColumnsConfig(email, boardId);
  // Valeur stable pour le contexte des étiquettes (sinon toutes les lignes se redessinent à chaque rendu).
  const columnsApiRef = useRef(columnsApi);
  columnsApiRef.current = columnsApi;
  const editLabels = useCallback((key: string, opts: any[]) => columnsApiRef.current.setOptions(key, opts), []);
  const [visibleCols, setVisibleCols] = useVisibleColumns(columnsVersion, boardId);
  const isMobile = useIsMobile();
  // Zoom du tableau : STRICTEMENT DISSOCIÉ entre smartphone et ordinateur.
  const [zoom, setZoom] = useState(() => {
    try {
      const isMob = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      if (isMob) {
        const saved = localStorage.getItem("crm-table-zoom-mobile");
        if (saved) {
          const z = parseFloat(saved);
          if (z >= 0.5 && z <= 1.5) return z;
        }
        return 0.75; // 75% par défaut sur smartphone
      } else {
        const saved = localStorage.getItem("crm-table-zoom-desktop") ?? localStorage.getItem("crm-table-zoom");
        if (saved) {
          const z = parseFloat(saved);
          if (z >= 0.6 && z <= 1.5) return z;
        }
        return 1; // 100% par défaut sur ordinateur
      }
    } catch {
      return 1;
    }
  });

  const changeZoom = (z: number) => {
    const minZ = isMobile ? 0.5 : 0.6;
    const v = Math.min(1.4, Math.max(minZ, Math.round(z * 100) / 100));
    setZoom(v);
    try {
      if (isMobile) {
        localStorage.setItem("crm-table-zoom-mobile", String(v));
      } else {
        localStorage.setItem("crm-table-zoom-desktop", String(v));
        localStorage.setItem("crm-table-zoom", String(v));
      }
    } catch {
      /* non essentiel */
    }
  };

  const setViewPersist = (v: "tableau" | "liste" | "colonnes") => {
    setView(v);
    try {
      localStorage.setItem("crm-leads-view", v);
    } catch {
      /* préférence non essentielle */
    }
  };

  const sources = useMemo(
    () => Array.from(new Set((leads ?? []).map((l) => l.source).filter(Boolean))).sort(),
    [leads],
  );

  // Filtres hors statut : le décompte par statut en dépend.
  const baseFiltered = useMemo(() => {
    if (!leads) return [];
    const q = normalize(query.trim());
    return leads.filter((l) => {
      if (filters.length && !applyFilters(l, filters)) return false;
      if (personKey) {
        const p = people.find((x) => x.key === personKey);
        if (p && !leadMatchesPerson(l, p)) return false;
      }
      if (rappelsOnly && !isOverdue(l)) return false;
      if (!q) return true;
      const qDigits = phoneDigitsOf(q);
      if (qDigits.length >= 3 && phoneDigitsOf(l.phone).includes(qDigits)) return true;
      const hay = normalize(
        [l.name, l.phone, phoneDigitsOf(l.phone), l.email, l.postalCode, l.city, l.projet, l.source]
          .join(" "),
      );
      return hay.includes(q);
    });
  }, [leads, query, filters, personKey, people, rappelsOnly]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of baseFiltered) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [baseFiltered]);

  const filtered = useMemo(
    () => sortLeads(statusFilter ? baseFiltered.filter((l) => l.status === statusFilter) : baseFiltered, sorts),
    [baseFiltered, statusFilter, sorts],
  );

  // Groupement automatique par une colonne (sinon : groupes personnalisés).
  const grouping = useMemo(() => (groupBy ? groupByColumn(filtered, groupBy) : null), [groupBy, filtered]);

  // Retour en haut de liste quand un filtre change.
  useEffect(() => setLimit(PAGE_SIZE), [query, statusFilter, filters, personKey, rappelsOnly]);

  const rappelsCount = useMemo(() => (leads ?? []).filter(isOverdue).length, [leads]);
  const openLead = leads?.find((l) => l.id === openId) ?? null;
  // Ouvrir le chat = lire le mail reçu : le repère « Réponse » disparaît du tableau.
  const chatLead = leads?.find((l) => l.id === chatId) ?? null;
  useEffect(() => {
    if (chatLead?.mailNonLu) patchLead(chatLead.id, email, { mailNonLu: false }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatLead?.id, chatLead?.mailNonLu]);

  const moveLead = async (id: string, status: LeadStatus) => {
    const lead = leads?.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    try {
      const { m } = await fs();
      await patchLead(id, email, {
        status,
        notes: m.arrayUnion({
          id: newId(),
          text: `${statusInfo(lead.status).label} → ${statusInfo(status).label}`,
          by: email,
          at: new Date().toISOString(),
          kind: "statut",
        } satisfies LeadNote),
      });
    } catch (e) {
      console.error(e);
      setError("Impossible de déplacer le lead. Réessayez.");
    }
  };

  // Groupes du tableau : lus en direct dans crm_boards/leads ; valeurs par
  // défaut tant que la liste n'a jamais été modifiée (ou illisible).
  const [groupsReady, setGroupsReady] = useState(false);
  const [groups, setGroups] = useState<LeadGroup[]>(
    boardId === LEADS_BOARD_ID ? DEFAULT_LEAD_GROUPS : [{ id: "nouveaux", title: "Nouveau groupe", color: "#579bfc" }],
  );
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await fs();
        unsub = m.onSnapshot(
          m.doc(db, CRM_BOARDS_COLLECTION, boardId),
          (snap) => {
            const g = snap.data()?.groups;
            if (!cancelled && Array.isArray(g) && g.length) setGroups(g as LeadGroup[]);
            if (!cancelled) setGroupsReady(true);
          },
          (e) => {
            console.error("Groupes non lisibles (règle crm_boards ?)", e);
            if (!cancelled) setGroupsReady(true);
          },
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) setGroupsReady(true);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Affichages enregistrés (filtres + tri + groupement + colonnes), partagés.
  type SavedView = { id: string; name: string; filters: LeadFilter[]; sorts: LeadSort[]; groupBy: string; personKey: string; visible: string[] };
  const [views, setViews] = useState<SavedView[]>([]);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await fs();
        unsub = m.onSnapshot(
          m.doc(db, CRM_BOARDS_COLLECTION, "leads_views"),
          (snap) => !cancelled && setViews((snap.data()?.views as SavedView[]) ?? []),
          () => {},
        );
      } catch {
        /* affichages indisponibles : le reste fonctionne */
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);
  // Tableau « vue » : colonnes de départ, et enregistrement automatique (après une
  // courte pause) des filtres, du tri, du groupement et des colonnes choisis.
  // (Les colonnes affichées ne sont plus imposées par la vue enregistrée à l'ouverture : chaque
  // appareil garde son propre choix par tableau, bouton « Masquer ».)
  useEffect(() => {
    if (!boardView || !onBoardViewChange) return;
    const current = { filters, sorts, groupBy, personKey, visible: visibleCols };
    const stored = { ...boardView, visible: boardView.visible?.length ? boardView.visible : visibleCols };
    if (JSON.stringify(current) === JSON.stringify(stored)) return;
    const t = setTimeout(() => onBoardViewChange(current), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sorts, groupBy, personKey, visibleCols]);

  const persistViews = async (next: SavedView[]) => {
    setViews(next);
    try {
      const { m, db } = await fs();
      await m.setDoc(m.doc(db, CRM_BOARDS_COLLECTION, "leads_views"), { views: next, updatedAt: m.serverTimestamp(), updatedBy: email });
    } catch (e) {
      console.error(e);
      setError("Impossible d'enregistrer l'affichage (règle Firestore crm_boards ?).");
    }
  };
  const saveView = (name: string) =>
    persistViews([...views, { id: newId(), name, filters, sorts, groupBy, personKey, visible: visibleCols }]);
  const applyView = (v: SavedView) => {
    setFilters(v.filters ?? []);
    setSorts(v.sorts ?? []);
    setGroupBy(v.groupBy ?? "");
    setPersonKey(v.personKey ?? "");
    if (v.visible?.length) setVisibleCols(v.visible);
  };

  // Actions groupées sur les lignes cochées du tableau.
  const bulkWrite = async (ids: string[], patchOf: Record<string, unknown> | ((id: string, m: any) => Record<string, unknown>), trace?: string) => {
    try {
      const { m, db } = await fs();
      for (let i = 0; i < ids.length; i += 400) {
        const batch = m.writeBatch(db);
        for (const id of ids.slice(i, i + 400)) {
          batch.update(m.doc(db, CRM_LEADS_COLLECTION, id), {
            ...(typeof patchOf === "function" ? patchOf(id, m) : patchOf),
            ...(trace
              ? { notes: m.arrayUnion({ id: newId(), text: trace, by: email, at: new Date().toISOString(), kind: "statut" }) }
              : {}),
            updatedAt: m.serverTimestamp(),
            updatedBy: email,
          });
        }
        await batch.commit();
      }
    } catch (e) {
      console.error(e);
      setError("L'action groupée a échoué. Réessayez.");
    }
  };
  const bulk = {
    setStatus: (ids: string[], status: string) => bulkWrite(ids, { status }, `Statut → ${statusInfo(status).label}`),
    moveGroup: (ids: string[], groupId: string) =>
      bulkWrite(ids, { group: groupId }, `Groupe → ${groups.find((g) => g.id === groupId)?.title ?? groupId}`),
    // Jamais de suppression directe : les fiches vont à la corbeille (30 jours).
    remove: (ids: string[]) => bulkWrite(ids, { deletedAt: new Date(), deletedBy: email }),
    exportCsv: (ids: string[]) => {
      const set = new Set(ids);
      const cols = LEAD_COLUMNS.filter((c) => visibleCols.includes(c.key));
      const blob = new Blob([leadsToCsv((leads ?? []).filter((l) => set.has(l.id)), cols)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-selection-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  };

  const exportCsv = () => {
    const cols = LEAD_COLUMNS.filter((c) => visibleCols.includes(c.key));
    const blob = new Blob([leadsToCsv(filtered, cols)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-ip5-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveGroups = async (next: LeadGroup[]) => {
    const previous = groups;
    setGroups(next); // affichage immédiat, annulé si l'enregistrement échoue
    try {
      const { m, db } = await fs();
      await m.setDoc(m.doc(db, CRM_BOARDS_COLLECTION, boardId), {
        groups: next,
        updatedAt: m.serverTimestamp(),
        updatedBy: email,
      });
    } catch (e) {
      console.error(e);
      setGroups(previous);
      setError(
        "Impossible d'enregistrer les groupes : la règle Firestore « crm_boards » n'est probablement pas encore publiée.",
      );
    }
  };

  const moveToGroup = async (id: string, groupId: string) => {
    const lead = leads?.find((l) => l.id === id);
    if (!lead) return;
    const from = groups.find((g) => g.id === lead.group) ?? groups[0];
    const to = groups.find((g) => g.id === groupId);
    if (!to || from.id === to.id) return;
    try {
      const { m } = await fs();
      await patchLead(id, email, {
        group: groupId,
        notes: m.arrayUnion({
          id: newId(),
          text: `Groupe : ${from.title} → ${to.title}`,
          by: email,
          at: new Date().toISOString(),
          kind: "statut",
        } satisfies LeadNote),
      });
    } catch (e) {
      console.error(e);
      setError("Impossible de changer le groupe. Réessayez.");
    }
  };

  // Duplication d'un groupe avec ses leads : copie des fiches (sans notes ni
  // documents) dans le nouveau groupe, par lots.
  const duplicateLeads = async (fromGroupId: string, toGroupId: string) => {
    try {
      const { m, db } = await fs();
      const src = (leads ?? []).filter((l) => groupOf(l, groups).id === fromGroupId).slice(0, 2000);
      for (let i = 0; i < src.length; i += 400) {
        const batch = m.writeBatch(db);
        for (const l of src.slice(i, i + 400)) {
          batch.set(m.doc(m.collection(db, CRM_LEADS_COLLECTION)), {
            name: l.name,
            phone: l.phone,
            email: l.email,
            postalCode: l.postalCode,
            city: l.city,
            type: l.type,
            source: l.source,
            projet: l.projet,
            status: l.status,
            group: toGroupId,
            board: boardId,
            rappelLe: l.rappelLe,
            fields: l.fields,
            details: l.details,
            notes: [],
            mailNonLu: false,
            docCount: 0,
            docCats: [],
            createdAt: m.serverTimestamp(),
            updatedAt: m.serverTimestamp(),
            updatedBy: email,
          });
        }
        await batch.commit();
      }
    } catch (e) {
      console.error(e);
      setError("La duplication des leads a échoué. Réessayez.");
    }
  };

  // Dupliquer une colonne : nouvelle colonne ajoutée à droite, avec les mêmes valeurs.
  const duplicateColumn = async (col: LeadColumn) => {
    const type: ColType =
      col.type === "status" ? "status" : col.type === "number" ? "number" : col.type === "date" ? "date" : col.type === "people" || col.type === "timeline" || col.type === "tags" ? col.type : "text";
    const created = columnsApi.addAfter(col.key, type, `${col.title} (copie)`);
    if (col.options) columnsApi.setOptions(created.key, col.options.map((o) => ({ ...o })));
    try {
      const { m, db } = await fs();
      const src = (leads ?? []).map((l) => ({ id: l.id, v: col.type === "formula" ? formulaValue(l, col) : cellValue(l, col) })).filter((x) => x.v);
      for (let i = 0; i < src.length; i += 400) {
        const batch = m.writeBatch(db);
        for (const x of src.slice(i, i + 400)) batch.update(m.doc(db, CRM_LEADS_COLLECTION, x.id), { [`fields.${created.key}`]: x.v });
        await batch.commit();
      }
    } catch (e) {
      console.error(e);
      setError("La copie des valeurs a échoué (la colonne a bien été créée).");
    }
  };

  // Chaque modification d'une cellule laisse une petite ligne dans la bulle de commentaires.
  const patchFromTable = async (id: string, patch: Record<string, unknown>) => {
    try {
      let full = patch;
      const lead = leads?.find((l) => l.id === id);
      const keys = Object.keys(patch);
      if (lead && keys.length === 1 && !("notes" in patch)) {
        const k = keys[0];
        const colKey = k.startsWith("fields.") ? k.slice(7) : k;
        const col = LEAD_COLUMNS.find((c) => c.key === colKey);
        if (col && col.type !== "name") {
          const before = cellValue(lead, col);
          const after = String(patch[k] ?? "");
          if (before !== after) {
            const { m } = await fs();
            full = {
              ...patch,
              notes: m.arrayUnion({
                id: newId(),
                text: `${col.title.replace(/^[^A-Za-z0-9\u00C0-\u00FF]+/, "")} : ${before || "vide"} → ${after || "vide"}`,
                by: email,
                at: new Date().toISOString(),
                kind: "statut",
              } satisfies LeadNote),
            };
          }
        }
      }
      await patchLead(id, email, full);
    } catch (e) {
      console.error(e);
      setError("Modification non enregistrée. Réessayez.");
    }
  };

  const createFromTable = async (groupId: string, name: string) => {
    try {
      const { m, db } = await fs();
      await m.addDoc(m.collection(db, CRM_LEADS_COLLECTION), {
        name,
        phone: "",
        email: "",
        postalCode: "",
        city: "",
        type: "PAC",
        board: boardId,
        source: "saisie-manuelle",
        projet: "",
        status: "nouveau_lead",
        group: groupId,
        rappelLe: "",
        details: {},
        notes: [],
        createdAt: m.serverTimestamp(),
        updatedAt: m.serverTimestamp(),
        updatedBy: email,
      });
    } catch (e) {
      console.error(e);
      setError("Impossible d'ajouter le lead. Réessayez.");
    }
  };

  const total = leads?.length ?? 0;

  return (
    <div>
      {/* Barre d'outils façon Monday */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1.5 no-scrollbar sm:flex-wrap sm:overflow-visible">
        <AddSplit
          onAddLead={() => setCreating(true)}
          onAddGroup={() => saveGroups([...groups, { id: `g_${newId()}`, title: "Nouveau groupe", color: "#579bfc" }])}
        />
        <SearchToggle value={query} onChange={setQuery} />
        <PersonBar people={people} selected={personKey} onSelect={setPersonKey} meKey={email.toLowerCase()} />
        <QuickFilter leads={leads ?? []} filters={filters} onFilters={setFilters} onSaveView={saveView} />
        <SortMenu sorts={sorts} onChange={setSorts} />
        {view === "tableau" && <ColumnsMenu visible={visibleCols} onChange={setVisibleCols} />}
        <GroupByMenu value={groupBy} onChange={setGroupBy} />
        <MoreMenu onExport={exportCsv} count={filtered.length} />
        {views.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const v = views.find((x) => x.id === e.target.value);
              if (v) applyView(v);
            }}
            className="text-sm font-semibold text-gray-700 bg-transparent border border-gray-200 rounded-md px-2 py-1.5"
          >
            <option value="">Affichages…</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        {(query || statusFilter || filters.length > 0 || personKey || rappelsOnly || sorts.length > 0 || groupBy) && (
          <button
            onClick={() => {
              setQuery("");
              setStatusFilter("");
              setFilters([]);
              setPersonKey("");
              setRappelsOnly(false);
              setSorts([]);
              setGroupBy("");
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 px-2"
          >
            <X size={12} /> Tout enlever
          </button>
        )}
        <div className="inline-flex items-center rounded-md border border-gray-200 bg-white" title="Zoom du tableau">
          <button onClick={() => changeZoom(zoom - 0.1)} aria-label="Dézoomer" className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-l-md">
            <ZoomOut size={15} />
          </button>
          <button onClick={() => changeZoom(1)} className="px-2 text-xs font-semibold text-gray-600 min-w-[3.25rem] whitespace-nowrap hover:bg-gray-100 py-1.5">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => changeZoom(zoom + 0.1)} aria-label="Zoomer" className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-r-md">
            <ZoomIn size={15} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setRappelsOnly((v) => !v)}
          className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border ${
            rappelsOnly ? "bg-red-100 text-red-700 border-red-200" : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          <BellRing size={12} /> Rappels{rappelsCount ? ` (${rappelsCount})` : ""}
        </button>
        <span className="text-xs text-gray-400">
          {filtered.length} sur {leads?.length ?? 0} noms sociétés
        </span>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {(!leads || !columnsReady || !groupsReady) && !error && <BrandLoader />}

      {leads && columnsReady && groupsReady && total === 0 && view !== "tableau" && (
        <p className="text-center text-gray-400 text-sm py-10">
          Aucun lead pour l'instant. Les demandes du site arrivent ici automatiquement ;
          vous pouvez aussi en ajouter un avec « Nouveau ».
        </p>
      )}

      {/* Vue tableau façon Monday */}
      {leads && columnsReady && groupsReady && view === "tableau" && (
        <StatusEditContext.Provider value={editLabels}>
        <div style={{ zoom }}>
        <LeadsTable
          leads={filtered}
          groups={grouping ? grouping.groups : groups}
          groupKeyOf={grouping?.keyOf}
          readOnlyGroups={!!grouping}
          columnsVersion={columnsVersion}
          columnMenu={(c) => (
            <ColumnMenu
              col={c}
              leads={leads ?? []}
              filters={filters}
              onFilters={setFilters}
              sorts={sorts}
              onSorts={setSorts}
              groupBy={groupBy}
              onGroupBy={setGroupBy}
              api={columnsApi}
              onDuplicate={duplicateColumn}
            />
          )}
          onAddColumn={(t) => {
            const last = LEAD_COLUMNS.filter((c) => visibleCols.includes(c.key)).slice(-1)[0];
            columnsApi.addAfter(last?.key ?? "name", t);
          }}
          visible={visibleCols}
          setVisible={setVisibleCols}
          onGroupsChange={saveGroups}
          onGroup={moveToGroup}
          onDuplicateLeads={duplicateLeads}
          bulk={bulk}
          fitZoom={zoom}
          onChangeZoom={changeZoom}
          onMoveColumn={(k, t) => columnsApi.move(k, t)}
          onRenameColumn={(k, title) => columnsApi.rename(k, title)}
          onResizeColumn={(k, w) => {
            if (isMobile) return;
            columnsApi.setWidth(k, w);
          }}
          onOpen={(id, focus) => {
            if (focus === "updates") {
              setChatId(id);
              return;
            }
            setOpenId(id);
            setFocusUpdates(false);
          }}
          onStatus={moveLead}
          onPatch={patchFromTable}
          onCreate={createFromTable}
        />
        </div>
        </StatusEditContext.Provider>
      )}

      {/* Vue liste */}
      {leads && total > 0 && view === "liste" && (
        <>
          <p className="text-xs text-gray-400 mb-2">
            {filtered.length} lead{filtered.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-2.5">
            {filtered.slice(0, limit).map((l) => (
              <LeadCard key={l.id} lead={l} onOpen={() => setOpenId(l.id)} />
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">
                Aucun lead ne correspond aux filtres.
              </p>
            )}
            {filtered.length > limit && (
              <button
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="w-full text-sm font-bold text-[#2b5a8f] py-3"
              >
                Afficher plus ({filtered.length - limit} restants)
              </button>
            )}
          </div>
        </>
      )}

      {/* Vue colonnes : glisser-déposer pour changer de statut (ordinateur) */}
      {leads && total > 0 && view === "colonnes" && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 items-start snap-x">
          {LEAD_STATUSES.map((s) => {
            const col = baseFiltered.filter((l) => l.status === s.key);
            return (
              <div
                key={s.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropOver(s.key);
                }}
                onDragLeave={() => setDropOver((d) => (d === s.key ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropOver(null);
                  const id = e.dataTransfer.getData("text/lead-id");
                  if (id) moveLead(id, s.key);
                }}
                className={`w-72 shrink-0 snap-start rounded-2xl p-2 ${
                  dropOver === s.key ? "bg-blue-100" : "bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.hex }} />
                  <span className="text-sm font-bold text-gray-800">{s.label}</span>
                  <span className="ml-auto text-xs font-semibold text-gray-500">
                    {col.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {col.slice(0, COLUMN_SIZE).map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      compact
                      draggable
                      onOpen={() => setOpenId(l.id)}
                    />
                  ))}
                  {col.length > COLUMN_SIZE && (
                    <button
                      onClick={() => {
                        setStatusFilter(s.key);
                        setViewPersist("liste");
                      }}
                      className="w-full text-xs font-bold text-[#2b5a8f] py-2"
                    >
                      Voir les {col.length - COLUMN_SIZE} autres
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadChat
        lead={leads?.find((l) => l.id === chatId) ?? null}
        email={email}
        onClose={() => setChatId(null)}
        onSend={async (id, text) => {
          await callFn("postUpdate", { kind: "lead", id, text });
        }}
        onSendMail={async (id, mail) => {
          await callFn("sendLeadMessage", { leadId: id, channel: "mail", template: mail.template, subject: mail.subject, body: mail.body, files: mail.files?.map((f) => ({ name: f.name, type: f.type, data: f.data })) });
        }}
        onSendSms={async (id, text) => {
          await callFn("sendLeadMessage", { leadId: id, channel: "sms", text });
        }}
        onLoadBalance={() => callFn<{ balance: number; currency: string }>("getTwilioBalance")}
        onLogWhatsApp={async (id, text) => {
          const { m } = await fs();
          await patchLead(id, email, {
            notes: m.arrayUnion({
              id: newId(),
              text: `💬 WhatsApp : « ${text.slice(0, 300)} »`,
              by: email,
              at: new Date().toISOString(),
              kind: "message",
            } satisfies LeadNote),
          });
        }}
        onLoadTemplates={async () => (await callFn<{ templates: { key: string; subject: string; sms?: string }[] }>("listLeadTemplates")).templates}
        onOpenFiche={(id) => {
          setChatId(null);
          setOpenId(id);
          setFocusUpdates(false);
        }}
      />

      {/* Barre d'outils flottante en bas sur mobile (façon Monday mobile app) */}
      <MobileBottomBar
        query={query}
        onQueryChange={setQuery}
        zoom={zoom}
        onChangeZoom={changeZoom}
        onAddLead={() => setCreating(true)}
        filters={filters}
        onFilters={setFilters}
        leads={leads ?? []}
        saveView={saveView}
      />

      <LeadSheet
        boardId={boardId}
        focusUpdates={focusUpdates}
        lead={openLead}
        creating={creating}
        email={email}
        onClose={() => {
          setOpenId(null);
          setCreating(false);
        }}
      />
    </div>
  );
}

// Chiffres seuls du téléphone, pour retrouver « 0612… » en tapant « 06 12… ».
function phoneDigitsOf(p: string) {
  return p.replace(/\D/g, "");
}
