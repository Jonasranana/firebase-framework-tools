import { MentionPicker, MentionText, TaggedLine } from "@/components/Mentions";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, ExternalLink, X, Paperclip, MessageSquareText } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APPEL_SLOTS, LEAD_COLUMNS } from "@/lib/crmColumns";
import { IaAnalyseButton, IaBubble, isIaNote, useIaFiches } from "@/components/RelanceIA";
import { findEtapeColumn } from "./DossiersBoard";
import { RAPPEL_HEURE_KEY, rappelShort } from "@/lib/rappel";
import { NEWS_VIEWERS, formatDateTime, formatPhone, statusInfo, whatsappHref, type Lead, type LeadNote } from "@/lib/crm";

// Prénom lisible à partir d'une adresse e-mail (« jonas.sitbon@… » → « Jonas »).
export const authorName = (by: string) => {
  if (!by) return "Inconnu";
  if (by === "automation") return "Automatisation";
  const local = by.split("@")[0].split(/[._-]/)[0];
  return local ? local[0].toUpperCase() + local.slice(1) : by;
};

const GmailLogo = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M2 7.2V17.5C2 18.3 2.7 19 3.5 19H6.5V10.4L2 7.2Z" />
    <path fill="#34A853" d="M17.5 19H20.5C21.3 19 22 18.3 22 17.5V7.2L17.5 10.4V19Z" />
    <path fill="#FBBC04" d="M17.5 5.8V10.4L22 7.2V6C22 4.5 20.3 3.7 19.1 4.5L17.5 5.8Z" />
    <path fill="#EA4335" d="M6.5 10.4V5.8L12 9.9L17.5 5.8V10.4L12 14.5L6.5 10.4Z" />
    <path fill="#C5221F" d="M2 6V7.2L6.5 10.4V5.8L4.9 4.5C3.7 3.7 2 4.5 2 6Z" />
  </svg>
);

const WhatsAppLogo = ({ size = 16, white = false }: { size?: number; white?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill={white ? "#fff" : "#25D366"} d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z" />
    <path fill={white ? "#16a34a" : "#fff"} d="M8.6 7.3c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4.9 2.9.7 3.4.7.5 0 1.6-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3l-1.9-.9c-.3-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.8-.8-1.400-1.7-1.500-2-.2-.3 0-.4.100-.6l.4-.5c.1-.1.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-2Z" />
  </svg>
);

export type MailFile = { name: string; type: string; data: string; size: number };
export type MailPreview = { to: string; subject: string; html: string; attachmentNames: string[] };
const MAX_TOTAL = 6 * 1024 * 1024;

// Lit un fichier en base64 ; les grosses photos sont réduites (2000 px, JPEG) pour rester sous la limite d'envoi.
const readFile = (f: File): Promise<MailFile> =>
  new Promise((resolve, reject) => {
    const toB64 = (blob: Blob, name: string, type: string) => {
      const r = new FileReader();
      r.onload = () => {
        const d = String(r.result);
        resolve({ name, type, data: d.slice(d.indexOf(",") + 1), size: blob.size });
      };
      r.onerror = () => reject(new Error("Lecture impossible"));
      r.readAsDataURL(blob);
    };
    if (f.type.startsWith("image/") && f.size > 1.5 * 1024 * 1024 && f.type !== "image/gif") {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 2000 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? toB64(b, f.name.replace(/\.\w+$/, "") + ".jpg", "image/jpeg") : toB64(f, f.name, f.type)), "image/jpeg", 0.85);
      };
      img.onerror = () => toB64(f, f.name, f.type);
      img.src = URL.createObjectURL(f);
    } else toB64(f, f.name, f.type);
  });

// Phrase simple pour une ligne de « mouvement » : qui a fait quoi.
export const movementText = (n: LeadNote) => {
  const who = n.by === "automation" ? "Une automatisation" : authorName(n.by);
  const t = n.text.trim();
  if (n.kind === "statut") {
    if (t.startsWith("🔔 Demande")) return `🔔 ${who} ${t.replace(/^🔔\s*Demande/, "demande")}`;
    if (t.startsWith("🔔 Rappel supprimé")) return `🔔 ${who} a supprimé le rappel`;
    const f = t.match(/^(.+?) : (.*) → (.*)$/);
    if (f) {
      const [, label, a, b] = f;
      if (label === "Groupe") return `${who} a déplacé le lead du groupe « ${a} » vers « ${b} »`;
      return `${who} a changé « ${label} » de « ${a || "vide"} » à « ${b || "vide"} »`;
    }
    const st = t.match(/^(.+) → (.+)$/);
    if (st) return `${who} a passé le statut de « ${st[1]} » à « ${st[2]} »`;
    return `${who} : ${t}`;
  }
  if (t.startsWith("💬 WhatsApp")) return `${who} a ouvert WhatsApp ${t.replace(/^💬 WhatsApp\s*:?\s*/, "")}`;
  if (t.startsWith("💬 SMS envoyé")) return `${who} a envoyé un SMS ${t.replace(/^💬 SMS envoyé\s*:?\s*/, "")}`;
  if (t.startsWith("✉️ Mail envoyé")) return `${who} a envoyé un mail ${t.replace(/^✉️ Mail envoyé\s*:?\s*/, "")}`;
  if (t.startsWith("📤 Mail envoyé")) return `${who} a envoyé un mail ${t.replace(/^📤 Mail envoyé\s*—?\s*/, "— ").split("\n")[0]}`;
  if (n.by === "automation") return `⚡ ${t.replace(/^⚡\s*/, "")}`;
  return `${who} : ${t}`;
};

export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const now = new Date();
  const yest = new Date(now.getTime() - 86400000);
  if (same(d, now)) return "Aujourd'hui";
  if (same(d, yest)) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};

// Un message d'équipe est une vraie « discussion » (grande bulle) ; tout le
// reste (changement de statut, de cellule, SMS/mail envoyé, automatisation)
// est une petite ligne discrète au centre.
export const isChat = (n: LeadNote) => (n.kind === undefined || n.kind === "note") && n.by !== "automation";
export const isMailReceived = (n: LeadNote) => n.kind === "mail" && n.text.startsWith("📥");

export default function LeadChat({
  lead,
  email,
  onClose,
  onSend,
  onSendMail,
  onLogWhatsApp,
  onSendSms,
  onLoadBalance,
  onLoadTemplates,
  onOpenFiche,
  onPreviewMail,
}: {
  lead: Lead | null;
  email: string;
  onClose: () => void;
  onSend: (leadId: string, text: string) => Promise<void>;
  onSendMail: (leadId: string, mail: { subject?: string; body?: string; template?: string; files?: MailFile[] }) => Promise<void>;
  onLogWhatsApp: (leadId: string, text: string) => Promise<void>;
  onSendSms: (leadId: string, text: string) => Promise<void>;
  onLoadBalance: () => Promise<{ balance: number; currency: string }>;
  onLoadTemplates: () => Promise<{ key: string; subject: string; sms?: string }[]>;
  onOpenFiche: (leadId: string) => void;
  // Aperçu exact du mail (fabriqué par le serveur, comme l'envoi) : objet, HTML, pièces jointes.
  onPreviewMail?: (leadId: string, mail: { template?: string; subject?: string; body?: string }) => Promise<MailPreview>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"tout" | "messages" | "mouvements">("tout");
  const [mailOpen, setMailOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tpl, setTpl] = useState("");
  const [templates, setTemplates] = useState<{ key: string; subject: string; sms?: string }[]>([]);
  const [smsOpen, setSmsOpen] = useState(false);
  // Assistant de relance (direction seulement) : bouton « 🤖 » sous chaque message.
  const iaFiches = useIaFiches();
  const canIa = NEWS_VIEWERS.includes(email.toLowerCase()) && iaFiches;
  const etapeCol = findEtapeColumn(LEAD_COLUMNS);
  const [smsText, setSmsText] = useState("");
  const [smsTpl, setSmsTpl] = useState("");
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsMsg, setSmsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [balance, setBalance] = useState<{ balance: number; currency: string } | "err" | null>(null);
  const [files, setFiles] = useState<MailFile[]>([]);
  const [waOpen, setWaOpen] = useState(false);
  const [waText, setWaText] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const count = lead?.notes.length ?? 0;

  const notes = useMemo(
    () => (lead ? [...lead.notes].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)) : []),
    [lead?.notes], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    setText("");
    setError("");
    setMailOpen(false);
    setSubject("");
    setBody("");
    setTpl("");
    setMailMsg(null);
    setFiles([]);
    setSmsOpen(false);
    setSmsText("");
    setSmsTpl("");
    setSmsMsg(null);
    setWaOpen(false);
    setWaText("");
    setTab("tout");
  }, [lead?.id]);

  const loadBalance = () => onLoadBalance().then(setBalance).catch(() => setBalance("err"));
  useEffect(() => {
    if (lead?.id) loadBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  // Modèles chargés dès l'ouverture de la fiche : ils s'affichent tout de suite en cliquant sur Gmail / SMS / WhatsApp.
  useEffect(() => {
    if (lead?.id && templates.length === 0) onLoadTemplates().then(setTemplates).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  // Aperçu exact du mail : demandé au serveur (même fabrication que l'envoi), un peu après la dernière frappe.
  const [preview, setPreview] = useState<{ loading: boolean; data: MailPreview | null; error: string }>({ loading: false, data: null, error: "" });
  useEffect(() => {
    if (!mailOpen || !lead || !onPreviewMail) return;
    if (!tpl && !subject.trim() && !body.trim()) return setPreview({ loading: false, data: null, error: "" });
    let stale = false;
    setPreview((p) => ({ ...p, loading: true, error: "" }));
    const t = setTimeout(
      () =>
        onPreviewMail(lead.id, tpl ? { template: tpl } : { subject, body })
          .then((data) => !stale && setPreview({ loading: false, data, error: "" }))
          .catch(() => !stale && setPreview({ loading: false, data: null, error: "Aperçu indisponible pour l'instant." })),
      tpl ? 0 : 700,
    );
    return () => {
      stale = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailOpen, tpl, subject, body, lead?.id]);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    try {
      const added = await Promise.all(Array.from(list).map(readFile));
      const next = [...files, ...added].slice(0, 5);
      if (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) {
        setMailMsg({ ok: false, text: "Pièces jointes trop lourdes (6 Mo maximum au total, 5 fichiers)." });
        return;
      }
      setMailMsg(null);
      setFiles(next);
    } catch {
      setMailMsg({ ok: false, text: "Impossible de lire ce fichier." });
    }
  };

  const sendSms = async () => {
    const t = smsText.trim();
    if (!lead || !t || smsBusy) return;
    if (!lead.phone) return setSmsMsg({ ok: false, text: "Ce lead n'a pas de numéro." });
    if (!confirm(`Envoyer ce SMS au ${formatPhone(lead.phone)} ?`)) return;
    setSmsBusy(true);
    setSmsMsg(null);
    try {
      await onSendSms(lead.id, t);
      setSmsMsg({ ok: true, text: "SMS envoyé." });
      setSmsText("");
      setSmsTpl("");
      loadBalance();
      setTimeout(() => setSmsOpen(false), 900);
    } catch (e: any) {
      setSmsMsg({ ok: false, text: e?.message || "Échec de l'envoi." });
    } finally {
      setSmsBusy(false);
    }
  };

  const openWhatsApp = async () => {
    if (!lead || !waText.trim()) return;
    const url = `${whatsappHref(lead.phone)}?text=${encodeURIComponent(waText.trim())}`;
    window.open(url, "_blank", "noopener");
    try {
      await onLogWhatsApp(lead.id, waText.trim());
    } catch {}
    setWaText("");
    setWaOpen(false);
  };

  const sendMail = async () => {
    if (!lead || mailBusy) return;
    if (!lead.email) return setMailMsg({ ok: false, text: "Ce lead n'a pas d'adresse e-mail." });
    if (!tpl && (!subject.trim() || !body.trim())) return setMailMsg({ ok: false, text: "Écrivez un objet et un message (ou choisissez un modèle)." });
    if (!confirm(`Envoyer ce mail à ${lead.email} ?`)) return;
    setMailBusy(true);
    setMailMsg(null);
    try {
      await onSendMail(lead.id, tpl ? { template: tpl } : { subject: subject.trim(), body: body.trim(), files });
      setMailMsg({ ok: true, text: "Mail envoyé." });
      setSubject("");
      setBody("");
      setTpl("");
      setFiles([]);
      setTimeout(() => setMailOpen(false), 900);
    } catch (e: any) {
      setMailMsg({ ok: false, text: e?.message || "Échec de l'envoi." });
    } finally {
      setMailBusy(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => endRef.current?.scrollIntoView({ block: "end" }), 60);
    return () => clearTimeout(t);
  }, [lead?.id, count]);

  const send = async () => {
    const t = text.trim();
    if (!lead || !t || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSend(lead.id, t);
      setText("");
    } catch {
      setError("Message non envoyé. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const st = lead ? statusInfo(lead.status) : null;
  const appels = lead ? APPEL_SLOTS.filter((s) => lead.fields[s.key]) : [];
  const chips: { k: string; v: string }[] = [];
  if (lead?.rappelLe) chips.push({ k: "Rappel", v: rappelShort(lead.rappelLe, lead.fields[RAPPEL_HEURE_KEY] ?? "") });
  appels.forEach((s) => chips.push({ k: s.short + " appel", v: lead!.fields[s.key] }));
  const lastSent = [...notes].reverse().find((n) => n.text.startsWith("📤") || n.text.startsWith("✉️"));
  if (lastSent) chips.push({ k: "Dernier mail", v: formatDateTime(lastSent.at) });

  let lastDay = "";
  const composing = mailOpen || smsOpen || waOpen;
  const closeAll = () => {
    setMailOpen(false);
    setSmsOpen(false);
    setWaOpen(false);
  };
  const smsTemplates = templates.filter((t) => t.sms);
  const initiales = (lead?.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  // Carte d'un modèle (mail, SMS ou WhatsApp) : cliquable, sélectionnée en bleu.
  const TplCard = ({ on, title, sub, onClick }: { on: boolean; title: string; sub?: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-3 py-2 transition ${on ? "border-[#2563eb] bg-[#eef3ff] ring-1 ring-[#2563eb]" : "border-gray-200 bg-white hover:border-[#bcd0fb] hover:bg-[#f6f8fe]"}`}
    >
      <span className="block text-[13px] font-bold text-gray-900 leading-tight">{title}</span>
      {sub && <span className="block text-[11.5px] text-gray-500 mt-0.5 line-clamp-2">{sub}</span>}
    </button>
  );
  const channelBtn = (on: boolean) =>
    `flex-1 inline-flex items-center justify-center gap-2 text-[13px] font-bold rounded-xl px-3 py-2 border transition disabled:opacity-40 disabled:cursor-not-allowed ${
      on ? "bg-[#1f2430] text-white border-[#1f2430]" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
    }`;

  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl xl:max-w-3xl p-0 flex flex-col gap-0 bg-[#f4f6fa]" dir="ltr">
        {/* ── En-tête : client, coordonnées, statut ─────────────────────────── */}
        <SheetHeader className="text-left bg-white border-b border-[#eceef3] px-5 pt-4 pb-3 space-y-3 shrink-0">
          <div className="flex items-center gap-3 pr-6">
            <span className="shrink-0 w-11 h-11 rounded-full bg-[#eef3ff] text-[#2552d0] font-extrabold flex items-center justify-center">{initiales}</span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-lg font-extrabold text-gray-900">{lead?.name || "Sans nom"}</SheetTitle>
              <SheetDescription className="text-[13px] truncate text-gray-500">
                {lead?.phone ? formatPhone(lead.phone) : "Pas de téléphone"}
                {lead?.email ? ` · ${lead.email}` : ""}
              </SheetDescription>
            </div>
            <button
              onClick={() => lead && onOpenFiche(lead.id)}
              className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-bold text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
            >
              <ExternalLink size={13} /> Fiche complète
            </button>
          </div>
          {/* Petit résumé en lecture seule : on ne modifie rien depuis ici. */}
          <div className="flex flex-wrap gap-1.5">
            {st && (!lead?.board || lead.board === "leads") && (
              <span className="text-[11.5px] font-bold text-white rounded-full px-2.5 py-0.5" style={{ background: st.hex }}>
                {st.label}
              </span>
            )}
            {chips.map((c) => (
              <span key={c.k} className="text-[11.5px] rounded-full bg-gray-100 text-gray-700 px-2.5 py-0.5">
                <span className="text-gray-400">{c.k} </span>
                <span className="font-semibold">{c.v}</span>
              </span>
            ))}
          </div>
          {/* Canaux : un clic ouvre la grande fenêtre d'envoi avec les modèles. */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setMailOpen((o) => !o); setSmsOpen(false); setWaOpen(false); }} className={channelBtn(mailOpen)}>
              <GmailLogo size={17} /> Gmail
            </button>
            <button
              onClick={() => { setWaOpen((o) => !o); setMailOpen(false); setSmsOpen(false); }}
              disabled={!lead || !whatsappHref(lead.phone)}
              title={lead && whatsappHref(lead.phone) ? undefined : "Pas de numéro"}
              className={channelBtn(waOpen)}
            >
              <WhatsAppLogo size={17} /> WhatsApp
            </button>
            <button
              onClick={() => { setSmsOpen((o) => !o); setMailOpen(false); setWaOpen(false); }}
              disabled={!lead?.phone}
              title={lead?.phone ? undefined : "Pas de numéro"}
              className={channelBtn(smsOpen)}
            >
              <MessageSquareText size={16} className={smsOpen ? "" : "text-[#c8102e]"} /> SMS
            </button>
          </div>
          {!composing && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-gray-500" title="Crédits restants sur le compte Twilio">
                {balance === null ? "Crédits SMS : …" : balance === "err" ? "Crédits SMS : indisponible" : (
                  <>
                    Crédits SMS : <span className={balance.balance < 5 ? "text-red-600" : "text-green-700"}>{balance.balance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {balance.currency === "USD" ? "$" : balance.currency === "EUR" ? "€" : balance.currency}</span>
                  </>
                )}
              </span>
              <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[11.5px] font-semibold">
                {([["tout", "Tout"], ["messages", "Messages"], ["mouvements", "Mouvements"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={`px-2.5 py-1 rounded-md ${tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SheetHeader>

        {/* ── Grande fenêtre d'envoi (Gmail / SMS / WhatsApp) ─────────────────── */}
        {composing && lead && (
          <div className="flex-1 min-h-0 flex flex-col bg-white">
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[#eceef3]">
              <span className="text-[13px] font-extrabold text-gray-900">
                {mailOpen ? `Mail à ${lead.email || "— (pas d'adresse)"}` : smsOpen ? `SMS au ${formatPhone(lead.phone)}` : `WhatsApp à ${formatPhone(lead.phone)}`}
              </span>
              {mailOpen && <span className="text-[11.5px] text-gray-500">depuis contact@ip5energie.com</span>}
              {smsOpen && balance && balance !== "err" && (
                <span className="text-[11.5px] text-gray-500">· crédits {balance.balance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {balance.currency === "USD" ? "$" : "€"}</span>
              )}
              <button onClick={closeAll} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-gray-900">
                <X size={14} /> Fermer
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
              {/* Modèles, visibles tout de suite */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Choisir un modèle</p>
                <div className="grid grid-cols-2 gap-2">
                  {mailOpen && (
                    <>
                      <TplCard on={!tpl} title="✍️ Mail libre" sub="J'écris moi-même, avec photos ou fichiers" onClick={() => setTpl("")} />
                      {templates.map((t) => (
                        <TplCard key={t.key} on={tpl === t.key} title={t.key} sub={t.subject} onClick={() => setTpl(t.key)} />
                      ))}
                    </>
                  )}
                  {smsOpen && (
                    <>
                      <TplCard on={!smsTpl} title="✍️ SMS libre" sub="J'écris moi-même" onClick={() => { setSmsTpl(""); setSmsText(""); }} />
                      {smsTemplates.map((t) => (
                        <TplCard key={t.key} on={smsTpl === t.key} title={t.key} sub={t.sms} onClick={() => { setSmsTpl(t.key); setSmsText(t.sms ?? ""); }} />
                      ))}
                    </>
                  )}
                  {waOpen &&
                    smsTemplates.map((t) => <TplCard key={t.key} on={waText === t.sms} title={t.key} sub={t.sms} onClick={() => setWaText(t.sms ?? "")} />)}
                </div>
                {templates.length === 0 && <p className="text-xs text-gray-400 mt-1">Chargement des modèles…</p>}
              </div>

              {/* Gmail : mail libre */}
              {mailOpen && !tpl && (
                <div className="space-y-2">
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={150}
                    placeholder="Objet du mail"
                    className="w-full text-[14px] bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2"
                  />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={9}
                    placeholder="Votre message au client…"
                    className="w-full text-[14px] bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2 resize-y min-h-[180px]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-gray-50">
                      <Paperclip size={13} /> Photo / fichier
                      <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                    </label>
                    {files.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-white border border-gray-200 rounded-full pl-2 pr-1 py-0.5 text-gray-700 max-w-[190px]">
                        <span className="truncate">{f.name}</span>
                        <span className="text-gray-400">{Math.max(1, Math.round(f.size / 1024))} Ko</span>
                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Retirer" className="text-gray-400 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Gmail : aperçu exact */}
              {mailOpen && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                    Aperçu exact du mail {preview.loading && <span className="normal-case font-semibold text-gray-400">· mise à jour…</span>}
                  </p>
                  {preview.data ? (
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-[12.5px] space-y-0.5">
                        <p><span className="text-gray-400 w-12 inline-block">De</span> IP5 Énergie &lt;contact@ip5energie.com&gt;</p>
                        <p><span className="text-gray-400 w-12 inline-block">À</span> {preview.data.to || "—"}</p>
                        <p><span className="text-gray-400 w-12 inline-block">Objet</span> <b className="text-gray-900">{preview.data.subject || "(sans objet)"}</b></p>
                        {(preview.data.attachmentNames.length > 0 || (!tpl && files.length > 0)) && (
                          <p>
                            <span className="text-gray-400 w-12 inline-block">📎</span> {[...preview.data.attachmentNames, ...(!tpl ? files.map((f) => f.name) : [])].join(", ")}
                          </p>
                        )}
                      </div>
                      <iframe title="Aperçu du mail" srcDoc={preview.data.html} sandbox="" className="w-full h-[480px] bg-white" />
                    </div>
                  ) : (
                    <p className="text-[13px] text-gray-400 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
                      {preview.error || (tpl ? "Chargement de l'aperçu…" : "Écrivez un objet et un message : l'aperçu exact s'affiche ici.")}
                    </p>
                  )}
                </div>
              )}

              {/* SMS */}
              {smsOpen && (
                <div className="space-y-2">
                  <textarea
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    rows={6}
                    maxLength={480}
                    placeholder="Votre SMS…"
                    className="w-full text-[14px] bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2 resize-y"
                  />
                  <p className="text-[11.5px] text-gray-500">
                    {smsText.length} / 480 caractères · environ {Math.max(1, Math.ceil(smsText.length / 153))} SMS facturé{smsText.length > 160 ? "s" : ""}
                  </p>
                  {smsText.trim() && (
                    <div className="rounded-2xl bg-gray-100 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Ce que le client recevra</p>
                      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white shadow-sm px-3.5 py-2.5 text-[14px] text-gray-900 whitespace-pre-wrap break-words">{smsText.trim()}</div>
                    </div>
                  )}
                </div>
              )}

              {/* WhatsApp */}
              {waOpen && (
                <div className="space-y-2">
                  <textarea
                    value={waText}
                    onChange={(e) => setWaText(e.target.value)}
                    rows={6}
                    placeholder="Écrivez votre message WhatsApp…"
                    className="w-full text-[14px] bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2 resize-y"
                  />
                  {waText.trim() && (
                    <div className="rounded-2xl bg-[#efeae2] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Aperçu WhatsApp</p>
                      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-[#d9fdd3] shadow-sm px-3.5 py-2.5 text-[14px] text-gray-900 whitespace-pre-wrap break-words">{waText.trim()}</div>
                    </div>
                  )}
                  <p className="text-[11.5px] text-gray-500">WhatsApp s'ouvre avec le message déjà écrit : il ne reste qu'à appuyer sur Envoyer là-bas.</p>
                </div>
              )}
            </div>

            {/* Bouton d'envoi, toujours visible */}
            <div className="border-t border-[#eceef3] px-5 py-3 bg-white">
              {mailOpen && mailMsg && <p className={`text-xs mb-1.5 ${mailMsg.ok ? "text-green-700" : "text-red-600"}`}>{mailMsg.text}</p>}
              {smsOpen && smsMsg && <p className={`text-xs mb-1.5 ${smsMsg.ok ? "text-green-700" : "text-red-600"}`}>{smsMsg.text}</p>}
              {mailOpen && (
                <button onClick={sendMail} disabled={mailBusy} className="w-full text-[14px] font-bold text-white bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 rounded-xl py-2.5">
                  {mailBusy ? "Envoi…" : tpl ? `Envoyer « ${tpl} »` : "Envoyer le mail"}
                </button>
              )}
              {smsOpen && (
                <button onClick={sendSms} disabled={smsBusy || !smsText.trim()} className="w-full text-[14px] font-bold text-white bg-[#c8102e] disabled:opacity-50 rounded-xl py-2.5">
                  {smsBusy ? "Envoi…" : "Envoyer le SMS"}
                </button>
              )}
              {waOpen && (
                <button onClick={openWhatsApp} disabled={!waText.trim()} className="w-full text-[14px] font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl py-2.5">
                  Ouvrir WhatsApp avec ce message
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Discussion ──────────────────────────────────────────────────── */}
        {!composing && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
              {notes.length === 0 && <p className="text-center text-xs text-gray-500 mt-8">Aucun message pour l'instant. Écrivez le premier ci-dessous.</p>}
              {notes
                .filter((n) => tab === "tout" || (tab === "messages" ? isChat(n) || isMailReceived(n) || isIaNote(n) : !(isChat(n) || isMailReceived(n) || isIaNote(n))))
                .map((n) => {
                  const day = dayLabel(n.at);
                  const sep =
                    day !== lastDay ? (
                      <div key={`d-${n.id}`} className="flex justify-center py-2">
                        <span className="text-[11px] font-semibold text-gray-500 bg-white rounded-full px-3 py-0.5 border border-[#eceef3]">{day}</span>
                      </div>
                    ) : null;
                  lastDay = day;

                  // Proposition de l'assistant IA (bulle violette, avec Valider).
                  if (isIaNote(n) && lead) {
                    return (
                      <div key={n.id}>
                        {sep}
                        <IaBubble lead={lead} note={n} email={email} etapeCol={etapeCol} />
                      </div>
                    );
                  }
                  // Grande bulle : un message d'équipe ou un mail reçu du client.
                  if (isChat(n) || isMailReceived(n)) {
                    const mine = isChat(n) && n.by === email;
                    const client = isMailReceived(n);
                    return (
                      <div key={n.id}>
                        {sep}
                        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                              mine
                                ? "bg-[#2563eb] text-white rounded-br-md"
                                : client
                                  ? "bg-[#fff4de] text-gray-900 rounded-bl-md border border-[#fde3b0]"
                                  : "bg-white text-gray-900 rounded-bl-md border border-[#eceef3]"
                            }`}
                          >
                            {!mine && (
                              <p className={`text-[11px] font-bold mb-0.5 ${client ? "text-[#a35b00]" : "text-[#2552d0]"}`}>
                                {client ? `${lead?.name || "Le client"} (mail reçu)` : authorName(n.by)}
                              </p>
                            )}
                            <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{client ? n.text.replace(/^📥\s*Mail reçu\s*—\s*/, "") : <MentionText text={n.text} light={mine} />}</p>
                            <TaggedLine note={n} light={mine} />
                            {isChat(n) && canIa && lead && <IaAnalyseButton lead={lead} note={n} etapeCol={etapeCol} light={mine} />}
                            <p className={`text-[10px] mt-0.5 text-right ${mine ? "text-white/70" : "text-gray-400"}`}>{hhmm(n.at)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Petite ligne : mouvement sur la ligne (qui a changé quoi), mail/SMS envoyé, automatisation.
                  return (
                    <div key={n.id}>
                      {sep}
                      <div className="flex justify-center">
                        <p className="max-w-[92%] text-center text-[11.5px] leading-snug text-gray-500 px-3 py-0.5 break-words">
                          {(() => {
                            const t = movementText(n);
                            return t.length > 200 ? t.slice(0, 200) + "…" : t;
                          })()}
                          <span className="text-gray-400"> · {hhmm(n.at)}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              <div ref={endRef} />
            </div>

            <div className="bg-white border-t border-[#eceef3] p-3">
              {error && <p className="text-xs text-red-600 mb-1 px-1">{error}</p>}
              <MentionPicker text={text} onPick={setText} />
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Écrire un message à l'équipe…"
                  className="flex-1 resize-none max-h-40 text-[14px] bg-gray-100 text-gray-900 rounded-2xl px-4 py-2.5 outline-none focus:bg-gray-50 focus:ring-2 focus:ring-[#2563eb]/30"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                />
                <button
                  onClick={send}
                  disabled={!text.trim() || busy}
                  aria-label="Envoyer"
                  className="shrink-0 h-10 w-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center disabled:opacity-40"
                >
                  <Send size={17} />
                </button>
              </div>
              {canIa && <p className="text-[11px] text-violet-700 font-semibold mt-1 px-1">🤖 Après l'envoi, le bouton « Analyser et planifier la relance » sous le message demande à l'IA la marche à suivre.</p>}
              <p className="text-[10.5px] text-gray-400 mt-1 px-1">Entrée pour envoyer · Maj+Entrée pour aller à la ligne · tapez @ pour taguer (Carole, Mebarek, Alexis, Jonas) : la personne reçoit aussi le message sur son mail perso</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
