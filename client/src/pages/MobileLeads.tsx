import { MentionPicker, MentionText, TaggedLine } from "@/components/Mentions";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BellRing, ChevronRight, FileText, MessageCircle, MessagesSquare, Phone, Search, Send, X } from "lucide-react";
import DossiersBoard, { etapeOptions, type DossierMove } from "./DossiersBoard";
import { authorName, dayLabel, hhmm, isChat, isMailReceived, movementText } from "./LeadChat";
import { RappelPicker } from "@/components/RappelCell";
import { LEAD_STATUSES, formatPhone, isClosedStatus, statusInfo, telHref, whatsappHref, type Lead, type LeadStatus } from "@/lib/crm";
import { ATTRIBUE, ATTRIBUE_KEY, type LeadColumn } from "@/lib/crmColumns";
import { RAPPEL_HEURE_KEY, rappelEnRetard, rappelShort } from "@/lib/rappel";
import { buildIcs, openIcs, type IcsEvent } from "@/lib/ics";
import { trancheInfo } from "@/lib/tranche";

// ─────────────────────────────────────────────────────────────────────────
// Version simple du CRM pour le téléphone : une liste de cartes au lieu du tableau,
// et une fiche en une seule colonne avec de gros boutons (appeler, WhatsApp, discussion)
// et les champs les plus utiles. La fiche complète reste accessible d'un bouton.
// Tout passe par les mêmes enregistrements que le tableau (rien n'est dupliqué).
// ─────────────────────────────────────────────────────────────────────────

// Version simple « carrée » : pas de zoom au pincement ni au double-appui tant que cet écran est ouvert
// (le tableau, lui, garde son zoom : l'ancien réglage est remis en quittant la version simple).
function useLockZoom() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const before = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover");
    const stop = (e: Event) => e.preventDefault();
    const stopMulti = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    // Safari (iPhone) ignore « user-scalable=no » : on bloque ses gestes de pincement à la main.
    document.addEventListener("gesturestart", stop);
    document.addEventListener("gesturechange", stop);
    document.addEventListener("gestureend", stop);
    document.addEventListener("touchmove", stopMulti, { passive: false });
    return () => {
      if (meta) {
        if (before === null) meta.removeAttribute("content");
        else meta.setAttribute("content", before);
      }
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("gestureend", stop);
      document.removeEventListener("touchmove", stopMulti);
    };
  }, []);
}

// ── Appels : application du téléphone ou OnOff Business ──────────────────────────────────────
// OnOff Business n'a pas de lien d'ouverture direct documenté : avec « OnOff », le bouton Appeler copie le
// numéro (prêt à coller dans OnOff) ; avec « Téléphone », il lance l'appel normalement (tel:).
type CallApp = "phone" | "onoff";
const CALL_KEY = "crm-call-app";
const readCallApp = (): CallApp => {
  try {
    return localStorage.getItem(CALL_KEY) === "onoff" ? "onoff" : "phone";
  } catch {
    return "phone";
  }
};
const CallCtx = createContext<{ app: CallApp; copy: (phone: string, name: string) => void }>({ app: "phone", copy: () => {} });
const nationalPhone = (raw: string) => {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("33") && d.length === 11) d = "0" + d.slice(2);
  return d;
};

const CallLabel = () => {
  const { app } = useContext(CallCtx);
  return <>{app === "onoff" ? "Copier (OnOff)" : "Appeler"}</>;
};

// Bouton / lien d'appel : suit le choix « Téléphone » ou « OnOff ».
const CallAction = ({ phone, name, className, children, style }: { phone: string; name: string; className?: string; children: React.ReactNode; style?: React.CSSProperties }) => {
  const { app, copy } = useContext(CallCtx);
  const tel = telHref(phone);
  if (!tel) return null;
  return app === "onoff" ? (
    <button onClick={() => copy(phone, name)} className={className} style={style}>
      {children}
    </button>
  ) : (
    <a href={tel} className={className} style={style}>
      {children}
    </a>
  );
};

const GRAD = "linear-gradient(90deg,#ff8a00,#ff4d4d 55%,#e0218a)";
const DAY = 86400000;

type Props = {
  email: string;
  etapeCol?: LeadColumn;
  // Groupes du tableau (« Nouveaux leads », « 1/ Leads Mebarek »…) et groupe de chaque lead.
  groups: { id: string; title: string; color: string }[];
  groupIdOf: (l: Lead) => string;
  onGroup: (id: string, groupId: string) => void;
  onMoveEtape: DossierMove;
  leads: Lead[];
  // Toutes les fiches (la fiche ouverte reste à jour même si elle sort de la liste filtrée).
  all: Lead[];
  total: number;
  onToTable: () => void;
  query: string;
  onQuery: (q: string) => void;
  rappelsOnly: boolean;
  onRappelsOnly: (v: boolean) => void;
  statusFilter: "" | LeadStatus;
  onStatusFilter: (s: "" | LeadStatus) => void;
  lateCount: number;
  newCount: number;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onStatus: (id: string, status: LeadStatus) => void;
  onNote: (id: string, text: string) => Promise<void>;
  onChat: (id: string) => void;
  onFull: (id: string) => void;
};

const ago = (iso: string) => {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const d = Math.floor((Date.now() - t) / DAY);
  return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : d < 30 ? `il y a ${d} j` : new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

const StatusPill = ({ status }: { status: LeadStatus }) => {
  const s = statusInfo(status);
  const o = LEAD_STATUSES.find((x) => x.key === status);
  return (
    <span className="inline-flex items-center text-[11px] font-bold text-white px-2.5 py-1 rounded-full" style={{ background: o?.hex ?? "#9ca3af" }}>
      {s.label || "Sans statut"}
    </span>
  );
};

const TrancheDot = ({ value }: { value: string }) => {
  const t = trancheInfo(value);
  return t ? (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-600" title={value}>
      <span className="inline-block w-3 h-3 rounded-full border border-black/10" style={{ background: t.color }} />
      {t.name}
    </span>
  ) : null;
};

const BigBtn = ({ href, onClick, icon, label, color }: { href?: string; onClick?: () => void; icon: React.ReactNode; label: string; color: string }) => {
  const cls = "flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-white text-[12px] font-bold active:scale-95 transition";
  const style = { background: color };
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls} style={style}>
      {icon}
      {label}
    </a>
  ) : (
    <button onClick={onClick} className={cls} style={style}>
      {icon}
      {label}
    </button>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
    <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2.5">{title}</h3>
    {children}
  </section>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block mb-3 last:mb-0">
    <span className="block text-xs font-semibold text-gray-500 mb-1">{label}</span>
    {children}
  </label>
);

const inputCls = "w-full text-base bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400";

// Champ texte enregistré quand on quitte la case.
const TextRow = ({ label, value, onSave, type = "text", inputMode }: { label: string; value: string; onSave: (v: string) => void; type?: string; inputMode?: "numeric" | "text" }) => {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <Row label={label}>
      <input
        value={v}
        type={type}
        inputMode={inputMode}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() !== value && onSave(v.trim())}
        className={inputCls}
      />
    </Row>
  );
};

// Avancement du dossier : les étapes de la colonne « Étape », l'étape actuelle en orange.
const Steps = ({ col, current, onPick }: { col?: LeadColumn; current: string; onPick: (k: string) => void }) => {
  const all = etapeOptions(col);
  const main = all.filter((p) => p.key !== "bloque");
  const idx = main.findIndex((p) => p.key === current);
  return (
    <div>
      <div className="flex gap-1 mb-2">
        {main.map((p, i) => (
          <span key={p.key} className="flex-1 h-1.5 rounded-full" style={{ background: idx >= 0 && i <= idx ? "#ff7a1a" : "#e5e7eb" }} />
        ))}
      </div>
      <select value={current} onChange={(e) => onPick(e.target.value)} className={inputCls}>
        <option value="">— Pas encore d'étape —</option>
        {all.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      {idx >= 0 && <p className="text-[11px] text-gray-400 mt-1">Étape {idx + 1} sur {main.length}</p>}
    </div>
  );
};

const LeadScreen = ({ lead, email, etapeCol, onMoveEtape, groups, groupId, onGroup, onClose, onPatch, onStatus, onNote, onChat, onFull }: { lead: Lead; groupId: string; onClose: () => void } & Pick<Props, "email" | "etapeCol" | "onMoveEtape" | "groups" | "onGroup" | "onPatch" | "onStatus" | "onNote" | "onChat" | "onFull">) => {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const f = lead.fields;
  const tel = telHref(lead.phone);
  const time = f[RAPPEL_HEURE_KEY] ?? "";
  const late = !!lead.rappelLe && rappelEnRetard(lead.rappelLe, time);
  const thread = (lead.notes ?? []).slice(-30);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lead.id, thread.length]);
  const save = (key: string, v: string) => onPatch(lead.id, { [`fields.${key}`]: v });

  const send = async () => {
    const t = note.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await onNote(lead.id, t);
      setNote("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto" dir="ltr" style={{ touchAction: "pan-y" }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-3 py-2.5 flex items-center gap-2">
        <button onClick={onClose} aria-label="Retour" className="w-10 h-10 -ml-1 inline-flex items-center justify-center rounded-full active:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-gray-900 truncate leading-tight">{lead.name || "Sans nom"}</p>
          <p className="text-xs text-gray-500 truncate">{[lead.phone && formatPhone(lead.phone), lead.postalCode].filter(Boolean).join(" · ")}</p>
        </div>
        <StatusPill status={lead.status} />
      </div>

      <div className="p-3 space-y-3 pb-24">
        <div className="flex gap-2">
          {tel && (
            <CallAction phone={lead.phone} name={lead.name} className="flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-white text-[12px] font-bold active:scale-95 transition" style={{ background: "#2b5a8f" }}>
              <Phone size={22} />
              <CallLabel />
            </CallAction>
          )}
          {tel && <BigBtn href={whatsappHref(lead.phone)} icon={<MessageCircle size={22} />} label="WhatsApp" color="#22c55e" />}
          <BigBtn onClick={() => onChat(lead.id)} icon={<MessagesSquare size={22} />} label="Discussion" color="#ff7a1a" />
        </div>

        {lead.rappelLe && (
          <div className={`rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-semibold ${late ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-800"}`}>
            <BellRing size={16} /> {late ? "Rappel en retard : " : "Rappel : "}
            {rappelShort(lead.rappelLe, time)}
          </div>
        )}

        <Section title="Où en est le dossier">
          <Row label="Statut d'appel">
            <select value={lead.status} onChange={(e) => onStatus(lead.id, e.target.value as LeadStatus)} className={inputCls}>
              {LEAD_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label || "(vide)"}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Étape du dossier">
            <Steps col={etapeCol} current={etapeCol ? f[etapeCol.key] ?? "" : ""} onPick={(k) => onMoveEtape(lead.id, k)} />
          </Row>
        </Section>

        <Section title="À faire">
          <Row label="Rappeler le">
            <RappelPicker
              trigger="field"
              date={lead.rappelLe}
              time={time}
              onSave={(d, t) => onPatch(lead.id, { rappelLe: d, [`fields.${RAPPEL_HEURE_KEY}`]: d ? t : "" })}
            />
          </Row>
          <Row label="Groupe">
            <select value={groupId} onChange={(e) => onGroup(lead.id, e.target.value)} className={inputCls}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Attribué à">
            <select value={f[ATTRIBUE_KEY] ?? ""} onChange={(e) => save(ATTRIBUE_KEY, e.target.value)} className={inputCls}>
              <option value="">— Personne —</option>
              {ATTRIBUE.filter((o) => !o.off).map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="Discussion">
          <div className="rounded-2xl bg-[#efeae2] p-2 max-h-[55vh] overflow-y-auto space-y-1.5">
            {thread.length === 0 && <p className="text-center text-xs text-gray-500 py-6">Aucun message pour l'instant.</p>}
            {(() => {
              let lastDay = "";
              return thread.map((n) => {
                const day = dayLabel(n.at);
                const sep =
                  day !== lastDay ? (
                    <div key={`d-${n.id}`} className="flex justify-center py-1">
                      <span className="text-[11px] font-semibold text-gray-600 bg-white/80 rounded-full px-3 py-0.5 shadow-sm">{day}</span>
                    </div>
                  ) : null;
                lastDay = day;
                if (isChat(n) || isMailReceived(n)) {
                  const mine = isChat(n) && n.by === email;
                  const client = isMailReceived(n);
                  return (
                    <div key={n.id}>
                      {sep}
                      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                            mine ? "bg-[#2b5a8f] text-white rounded-br-sm" : client ? "bg-[#fff1d6] text-gray-900 rounded-bl-sm" : "bg-white text-gray-900 rounded-bl-sm"
                          }`}
                        >
                          {!mine && (
                            <p className={`text-[11px] font-bold mb-0.5 ${client ? "text-[#a35b00]" : "text-[#2b5a8f]"}`}>
                              {client ? `${lead.name || "Le client"} (mail reçu)` : authorName(n.by)}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{client ? n.text.replace(/^📥\s*Mail reçu\s*—\s*/, "") : <MentionText text={n.text} light={mine} />}</p>
                          <TaggedLine note={n} light={mine} />
                          <p className={`text-[10px] mt-0.5 text-right ${mine ? "text-white/70" : "text-gray-400"}`}>{hhmm(n.at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                }
                const t = movementText(n);
                return (
                  <div key={n.id}>
                    {sep}
                    <div className="flex justify-center">
                      <p className="max-w-[94%] text-center text-[11px] leading-snug text-gray-600 bg-white/70 rounded-full px-3 py-1 break-words">
                        {t.length > 160 ? t.slice(0, 160) + "…" : t}
                        <span className="text-gray-400"> · {hhmm(n.at)}</span>
                      </p>
                    </div>
                  </div>
                );
              });
            })()}
            <div ref={endRef} />
          </div>
          <div className="mt-2">
            <MentionPicker text={note} onPick={setNote} />
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={1}
              placeholder="Écrire un message à l'équipe…"
              className="flex-1 resize-none max-h-32 text-base bg-gray-100 text-gray-900 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#2b5a8f]/30"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button onClick={send} disabled={!note.trim() || sending} aria-label="Envoyer" className="shrink-0 h-11 w-11 rounded-full bg-[#2b5a8f] text-white flex items-center justify-center disabled:opacity-40">
              <Send size={18} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">L'équipe est prévenue par e-mail. Tapez @ pour taguer quelqu'un : il le reçoit aussi sur son mail perso.</p>
          <button onClick={() => onChat(lead.id)} className="mt-2 w-full text-sm font-bold text-orange-600 py-2">
            Ouvrir la discussion complète (mail, SMS, WhatsApp)
          </button>
        </Section>

        <Section title="Informations du client">
          <div className="flex items-center gap-3 mb-3 text-sm text-gray-600">
            <span className="font-semibold text-gray-500 text-xs">Tranche de revenus</span>
            <TrancheDot value={f.tranche ?? ""} />
            {!trancheInfo(f.tranche ?? "") && <span className="text-gray-300">—</span>}
          </div>
          <TextRow label="Code postal" value={lead.postalCode} inputMode="numeric" onSave={(v) => onPatch(lead.id, { postalCode: v })} />
          <TextRow label="Chauffage actuel" value={f.chauffageSite ?? ""} onSave={(v) => save("chauffageSite", v)} />
          <TextRow label="Surface (m²)" value={f.surface ?? ""} inputMode="numeric" onSave={(v) => save("surface", v)} />
          <TextRow label="Personnes au foyer" value={f.foyerSite ?? ""} inputMode="numeric" onSave={(v) => save("foyerSite", v)} />
        </Section>

        <button onClick={() => onFull(lead.id)} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-white py-3.5 font-bold text-gray-700 active:bg-gray-50">
          <FileText size={18} /> Fiche complète et documents
          {lead.docCount > 0 && <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5">{lead.docCount}</span>}
        </button>
      </div>
    </div>
  );
};

// ── Agenda des rappels : par jour, avec alarme dans l'agenda du téléphone (.ics) ─────────────
const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymdOf(d);
};

const rappelEvent = (l: Lead): IcsEvent => ({
  uid: `${l.id}-${l.rappelLe}-${(l.fields[RAPPEL_HEURE_KEY] ?? "").replace(":", "")}@ip5energie.fr`,
  date: l.rappelLe,
  time: l.fields[RAPPEL_HEURE_KEY] ?? "",
  title: `📞 Rappeler ${l.name || "le client"}`,
  description: [l.phone && `Tél : ${formatPhone(l.phone)}`, `Statut : ${statusInfo(l.status).label || "—"}`, l.postalCode && `CP : ${l.postalCode}`, "Ouvrir dans le CRM : https://ip5energie.fr/admin"].filter(Boolean).join("\n"),
});

const AgendaView = ({ all, email, onOpen }: { all: Lead[]; email: string; onOpen: (id: string) => void }) => {
  // « Mes rappels » = les clients qui me sont attribués (le prénom de l'attribution se retrouve dans mon adresse).
  const mine = ATTRIBUE.find((o) => !o.off && email.toLowerCase().includes(o.label.toLowerCase().slice(0, 4)));
  const [scope, setScope] = useState<"mine" | "all">(mine ? "mine" : "all");
  const [done, setDone] = useState("");

  const items = useMemo(
    () =>
      all
        .filter((l) => l.rappelLe && !isClosedStatus(l.status) && (scope === "all" || !mine || l.fields[ATTRIBUE_KEY] === mine.key))
        .sort((a, b) => (a.rappelLe + (a.fields[RAPPEL_HEURE_KEY] ?? "99:99")).localeCompare(b.rappelLe + (b.fields[RAPPEL_HEURE_KEY] ?? "99:99"))),
    [all, scope, mine],
  );

  const sections = useMemo(() => {
    const today = ymdOf(new Date());
    const tomorrow = addDays(1);
    const week = addDays(7);
    const defs = [
      { key: "late", title: "En retard", tone: "text-red-600", test: (l: Lead) => rappelEnRetard(l.rappelLe, l.fields[RAPPEL_HEURE_KEY] ?? "") },
      { key: "today", title: "Aujourd'hui", tone: "text-orange-600", test: (l: Lead) => l.rappelLe === today },
      { key: "tomorrow", title: "Demain", tone: "text-gray-800", test: (l: Lead) => l.rappelLe === tomorrow },
      { key: "week", title: "Cette semaine", tone: "text-gray-800", test: (l: Lead) => l.rappelLe > tomorrow && l.rappelLe <= week },
      { key: "later", title: "Plus tard", tone: "text-gray-800", test: () => true },
    ];
    const used = new Set<string>();
    return defs
      .map((d) => {
        const list = items.filter((l) => !used.has(l.id) && d.test(l));
        list.forEach((l) => used.add(l.id));
        return { ...d, list };
      })
      .filter((d) => d.list.length);
  }, [items]);

  const upcoming = items.filter((l) => !rappelEnRetard(l.rappelLe, l.fields[RAPPEL_HEURE_KEY] ?? ""));
  const addOne = async (l: Lead) => {
    await openIcs(buildIcs([rappelEvent(l)]), `rappel-${(l.name || "client").replace(/[^a-z0-9]+/gi, "-")}.ics`);
    setDone(l.id);
  };
  const addAll = async () => {
    await openIcs(buildIcs(upcoming.map(rappelEvent)));
    setDone("all");
  };

  return (
    <div className="mt-2">
      {mine && (
        <div className="flex rounded-2xl bg-gray-200/70 p-1 mb-3">
          {([["mine", `Mes rappels (${mine.label})`], ["all", "Toute l'équipe"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)} className={`flex-1 text-[13px] font-bold py-2 rounded-xl ${scope === k ? "bg-white text-[#c2410c] shadow-sm" : "text-gray-500"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={addAll}
        disabled={!upcoming.length}
        className="w-full rounded-2xl py-3.5 text-white font-bold disabled:opacity-40 active:scale-[0.99] transition"
        style={{ background: GRAD }}
      >
        ⏰ Ajouter mes {upcoming.length} rappel{upcoming.length > 1 ? "s" : ""} à mon téléphone
      </button>
      <p className="text-[11px] text-gray-400 mt-1.5 mb-3 px-1">
        Ils s'ajoutent à l'agenda de l'iPhone ou d'Android, avec une alarme 10 minutes avant et à l'heure, et le nom du client à rappeler.
        {done === "all" && <b className="text-green-600"> Envoyé à l'agenda.</b>}
      </p>

      {sections.length === 0 && <p className="text-center text-gray-400 text-sm py-10">Aucun rappel prévu.</p>}
      {sections.map((sec) => (
        <div key={sec.key} className="mb-4">
          <h3 className={`text-sm font-extrabold mb-1.5 px-1 ${sec.tone}`}>
            {sec.title} <span className="text-gray-400 font-bold">({sec.list.length})</span>
          </h3>
          <div className="space-y-2">
            {sec.list.map((l) => {
              const time = l.fields[RAPPEL_HEURE_KEY] ?? "";
              const tel = telHref(l.phone);
              const late = sec.key === "late";
              return (
                <div key={l.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${late ? "border-red-200" : "border-gray-100"}`}>
                  <button onClick={() => onOpen(l.id)} className="w-full text-left p-3 flex items-center gap-3 active:bg-orange-50/60">
                    <div className={`shrink-0 w-14 text-center rounded-xl py-1.5 ${late ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-800"}`}>
                      <p className="text-base font-extrabold leading-tight">{time || "—"}</p>
                      <p className="text-[10px] font-semibold">{sec.key === "today" || sec.key === "late" && l.rappelLe === ymdOf(new Date()) ? "aujourd'hui" : rappelShort(l.rappelLe, "").replace(/^\S+\s/, "").slice(0, 9)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-gray-900 truncate">{l.name || "Sans nom"}</p>
                      <p className="text-xs text-gray-500 truncate">{[l.phone && formatPhone(l.phone), l.postalCode].filter(Boolean).join(" · ")}</p>
                      <div className="mt-1">
                        <StatusPill status={l.status} />
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 shrink-0" />
                  </button>
                  <div className="flex border-t border-gray-100 text-sm font-bold">
                    {tel && (
                      <CallAction phone={l.phone} name={l.name} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-[#2b5a8f] active:bg-gray-50">
                        <Phone size={15} /> <CallLabel />
                      </CallAction>
                    )}
                    <button onClick={() => addOne(l)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-orange-600 border-l border-gray-100 active:bg-gray-50">
                      ⏰ {done === l.id ? "Ajouté" : "Alarme"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function MobileLeads(props: Props) {
  useLockZoom();
  const { leads, all, total, query, onQuery, rappelsOnly, onRappelsOnly, lateCount } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const [tab, setTab] = useState<"liste" | "agenda" | "dossiers">("liste");
  const [groupFilter, setGroupFilter] = useState("");
  const [callApp, setCallAppState] = useState<CallApp>(readCallApp);
  const [toast, setToast] = useState("");
  const setCallApp = (a: CallApp) => {
    setCallAppState(a);
    try {
      localStorage.setItem(CALL_KEY, a);
    } catch {
      /* non essentiel */
    }
  };
  const copyNumber = async (phone: string, name: string) => {
    const num = nationalPhone(phone);
    const android = /android/i.test(navigator.userAgent);
    let ok = true;
    try {
      await navigator.clipboard.writeText(num);
    } catch {
      ok = false;
    }
    setToast(
      ok
        ? `✅ Numéro de ${name || "le client"} copié (${formatPhone(phone)}). ${android ? "OnOff s'ouvre : colle-le." : "Ouvre OnOff Business et colle-le."}`
        : `Numéro à composer dans OnOff : ${formatPhone(phone)}`,
    );
    setTimeout(() => setToast(""), 6000);
    // Android : ouvre directement l'app OnOff Business (iPhone : pas de lien d'ouverture connu)
    if (android && ok) {
      window.location.href =
        "intent://#Intent;package=com.onoffapp.app.b2b;S.browser_fallback_url=" +
        encodeURIComponent("https://play.google.com/store/apps/details?id=com.onoffapp.app.b2b") +
        ";end";
    }
  };
  const topRef = useRef<HTMLDivElement>(null);
  const openLead = useMemo(() => (openId ? all.find((l) => l.id === openId) ?? null : null), [all, openId]);
  useEffect(() => setLimit(30), [query, rappelsOnly, groupFilter]);
  const { groups, groupIdOf } = props;
  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) m.set(groupIdOf(l), (m.get(groupIdOf(l)) ?? 0) + 1);
    return m;
  }, [leads, groupIdOf]);
  const shown = useMemo(() => (groupFilter ? leads.filter((l) => groupIdOf(l) === groupFilter) : leads), [leads, groupFilter, groupIdOf]);

  // Pastilles sobres : la pastille choisie est pleine (couleur du groupe), les autres sont blanches.
  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap text-[13px] font-semibold px-3.5 py-2 rounded-full border ${active ? "text-white border-transparent shadow-sm" : "bg-white text-gray-700 border-gray-200"}`;
  const noFilter = !rappelsOnly && groupFilter === "";

  return (
    <CallCtx.Provider value={{ app: callApp, copy: copyNumber }}>
    <div ref={topRef} style={{ touchAction: "pan-x pan-y" }}>
      <div className="sticky top-0 z-20 -mx-4 px-4 pt-1 pb-2 bg-gray-50/95 backdrop-blur">
        <div className="flex rounded-2xl bg-gray-200/70 p-1 mb-2">
          {([["liste", "📋 Clients"], ["agenda", "📅 Agenda"], ["dossiers", "📁 Dossiers"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 text-[13px] font-bold py-2 rounded-xl ${tab === k ? "bg-white text-[#c2410c] shadow-sm" : "text-gray-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab !== "agenda" && (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Nom, téléphone, e-mail, code postal…"
                className="w-full text-base bg-white border-2 border-gray-200 rounded-2xl pl-10 pr-10 py-2.5 outline-none focus:border-orange-400"
              />
              {query && (
                <button onClick={() => onQuery("")} aria-label="Effacer" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              )}
            </div>
            {tab === "liste" && (
              <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                <button onClick={() => { onRappelsOnly(false); setGroupFilter(""); }} className={chip(noFilter)} style={noFilter ? { background: "#374151" } : undefined}>
                  Tous
                </button>
                <button onClick={() => onRappelsOnly(!rappelsOnly)} className={chip(rappelsOnly)} style={rappelsOnly ? { background: "#ef4444" } : undefined}>
                  🔔 À rappeler{lateCount ? ` (${lateCount})` : ""}
                </button>
                {groups.map((g) => {
                  const n = groupCounts.get(g.id) ?? 0;
                  if (!n && groupFilter !== g.id) return null;
                  const on = groupFilter === g.id;
                  return (
                    <button key={g.id} onClick={() => setGroupFilter(on ? "" : g.id)} className={chip(on)} style={on ? { background: g.color } : undefined}>
                      {!on && <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: g.color }} />}
                      {g.title} ({n})
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-gray-400">
                {tab === "liste" ? shown.length : leads.length} sur {total} client{total > 1 ? "s" : ""}
              </p>
              <button onClick={props.onToTable} className="text-[11px] font-semibold text-gray-500 underline">
                Voir en tableau
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] font-semibold text-gray-500">Appeler avec</span>
              <div className="flex rounded-full bg-gray-200/70 p-0.5">
                {([["phone", "📞 Téléphone"], ["onoff", "🟣 OnOff Business"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setCallApp(k)} className={`text-[12px] font-bold px-3 py-1 rounded-full ${callApp === k ? "bg-white text-[#c2410c] shadow-sm" : "text-gray-500"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {tab === "agenda" && <AgendaView all={all} email={props.email} onOpen={setOpenId} />}

      {tab === "dossiers" && (
        <div className="mt-2">
          <DossiersBoard leads={leads} etapeCol={props.etapeCol} onOpen={setOpenId} onMove={props.onMoveEtape} compact />
        </div>
      )}

      {tab === "liste" && (
      <div className="space-y-2.5 mt-1">
        {shown.slice(0, limit).map((l) => {
          const tel = telHref(l.phone);
          const time = l.fields[RAPPEL_HEURE_KEY] ?? "";
          const late = !!l.rappelLe && rappelEnRetard(l.rappelLe, time);
          const ec = props.etapeCol;
          const etape = ec ? etapeOptions(ec).find((p) => p.key === l.fields[ec.key]) : undefined;
          return (
            <div key={l.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => setOpenId(l.id)} className="w-full text-left p-3.5 active:bg-orange-50/60">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-gray-900 truncate">{l.name || "Sans nom"}</p>
                    <p className="text-xs text-gray-500 truncate">{[l.phone && formatPhone(l.phone), l.postalCode].filter(Boolean).join(" · ")}</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 mt-1 shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <StatusPill status={l.status} />
                  {etape && (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full text-white" style={{ background: etape.hex }}>
                      {etape.label}
                    </span>
                  )}
                  <TrancheDot value={l.fields.tranche ?? ""} />
                  {(() => {
                    const g = groups.find((x) => x.id === groupIdOf(l));
                    return g ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                        <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                        {g.title}
                      </span>
                    ) : null;
                  })()}
                  {l.rappelLe && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${late ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-800"}`}>
                      <BellRing size={10} /> {rappelShort(l.rappelLe, time)}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-gray-400">{ago(l.createdAt)}</span>
                </div>
              </button>
              {tel && (
                <div className="flex border-t border-gray-100">
                  <CallAction phone={l.phone} name={l.name} className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-bold text-[#2b5a8f] active:bg-gray-50">
                    <Phone size={16} /> <CallLabel />
                  </CallAction>
                  <a href={whatsappHref(l.phone)} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-bold text-green-600 border-l border-gray-100 active:bg-gray-50">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-center text-gray-400 text-sm py-10">Aucun client ne correspond.</p>}
        {shown.length > limit && (
          <button onClick={() => setLimit((n) => n + 30)} className="w-full text-sm font-bold text-orange-600 py-3">
            Afficher plus ({shown.length - limit} restants)
          </button>
        )}
      </div>
      )}

      {openLead && (
        <LeadScreen
          lead={openLead}
          email={props.email}
          etapeCol={props.etapeCol}
          onMoveEtape={props.onMoveEtape}
          groups={groups}
          groupId={groupIdOf(openLead)}
          onGroup={props.onGroup}
          onClose={() => setOpenId(null)}
          onPatch={props.onPatch}
          onStatus={props.onStatus}
          onNote={props.onNote}
          onChat={props.onChat}
          onFull={props.onFull}
        />
      )}

      {toast && (
        <div className="fixed left-3 right-3 bottom-4 z-[60] rounded-2xl bg-gray-900 text-white text-sm font-semibold px-4 py-3 shadow-2xl" role="status" onClick={() => setToast("")}>
          {toast}
        </div>
      )}
    </div>
    </CallCtx.Provider>
  );
}
