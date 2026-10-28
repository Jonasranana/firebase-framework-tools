import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BellRing, ChevronRight, FileText, MessageCircle, MessagesSquare, Phone, Search, Send, X } from "lucide-react";
import { RappelPicker } from "@/components/RappelCell";
import { LEAD_STATUSES, formatPhone, statusInfo, telHref, whatsappHref, type Lead, type LeadStatus } from "@/lib/crm";
import { ATTRIBUE, ATTRIBUE_KEY, PIPELINE } from "@/lib/crmColumns";
import { RAPPEL_HEURE_KEY, rappelEnRetard, rappelShort } from "@/lib/rappel";
import { trancheInfo } from "@/lib/tranche";

// ─────────────────────────────────────────────────────────────────────────
// Version simple du CRM pour le téléphone : une liste de cartes au lieu du tableau,
// et une fiche en une seule colonne avec de gros boutons (appeler, WhatsApp, discussion)
// et les champs les plus utiles. La fiche complète reste accessible d'un bouton.
// Tout passe par les mêmes enregistrements que le tableau (rien n'est dupliqué).
// ─────────────────────────────────────────────────────────────────────────

const GRAD = "linear-gradient(90deg,#ff8a00,#ff4d4d 55%,#e0218a)";
const DAY = 86400000;

type Props = {
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

// Avancement du dossier : les étapes du pipeline, l'étape actuelle en orange.
const Steps = ({ current, onPick }: { current: string; onPick: (k: string) => void }) => {
  const main = PIPELINE.filter((p) => !["Pas bon", "BETSALEL", "PRAIMY"].includes(p.key));
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
        {PIPELINE.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      {idx >= 0 && <p className="text-[11px] text-gray-400 mt-1">Étape {idx + 1} sur {main.length}</p>}
    </div>
  );
};

const LeadScreen = ({ lead, onClose, onPatch, onStatus, onNote, onChat, onFull }: { lead: Lead; onClose: () => void } & Pick<Props, "onPatch" | "onStatus" | "onNote" | "onChat" | "onFull">) => {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const f = lead.fields;
  const tel = telHref(lead.phone);
  const time = f[RAPPEL_HEURE_KEY] ?? "";
  const late = !!lead.rappelLe && rappelEnRetard(lead.rappelLe, time);
  const lastNotes = [...(lead.notes ?? [])].filter((n) => !n.kind || n.kind === "note").slice(-3).reverse();
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
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto" dir="ltr">
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
          {tel && <BigBtn href={tel} icon={<Phone size={22} />} label="Appeler" color="#2b5a8f" />}
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
            <Steps current={f.pipeline ?? ""} onPick={(k) => save("pipeline", k)} />
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

        <Section title="Ajouter une note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ex. : rappeler demain, attend l'avis d'imposition…"
            className={`${inputCls} resize-none`}
          />
          <button
            onClick={send}
            disabled={!note.trim() || sending}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-white font-bold disabled:opacity-40"
            style={{ background: GRAD }}
          >
            <Send size={16} /> {sending ? "Envoi…" : "Envoyer la note"}
          </button>
          {lastNotes.length > 0 && (
            <ul className="mt-3 space-y-2">
              {lastNotes.map((n) => (
                <li key={n.id} className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="block text-[11px] text-gray-400 mb-0.5">{String(n.by ?? "").split("@")[0]} · {ago(n.at)}</span>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
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

export default function MobileLeads(props: Props) {
  const { leads, all, total, query, onQuery, rappelsOnly, onRappelsOnly, statusFilter, onStatusFilter, lateCount, newCount } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const topRef = useRef<HTMLDivElement>(null);
  const openLead = useMemo(() => (openId ? all.find((l) => l.id === openId) ?? null : null), [all, openId]);
  useEffect(() => setLimit(30), [query, rappelsOnly, statusFilter]);

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap text-[13px] font-bold px-3.5 py-2 rounded-full border-2 ${active ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`;
  const none = !rappelsOnly && statusFilter === "";

  return (
    <div ref={topRef}>
      <div className="sticky top-0 z-20 -mx-4 px-4 pt-1 pb-2 bg-gray-50/95 backdrop-blur">
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
        <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          <button onClick={() => { onRappelsOnly(false); onStatusFilter(""); }} className={chip(none)} style={none ? { background: GRAD } : undefined}>
            Tous
          </button>
          <button onClick={() => { onStatusFilter(""); onRappelsOnly(!rappelsOnly); }} className={chip(rappelsOnly)} style={rappelsOnly ? { background: "#ef4444" } : undefined}>
            🔔 À rappeler{lateCount ? ` (${lateCount})` : ""}
          </button>
          <button
            onClick={() => { onRappelsOnly(false); onStatusFilter(statusFilter === "nouveau_lead" ? "" : "nouveau_lead"); }}
            className={chip(statusFilter === "nouveau_lead")}
            style={statusFilter === "nouveau_lead" ? { background: "#2b5a8f" } : undefined}
          >
            🆕 Nouveaux{newCount ? ` (${newCount})` : ""}
          </button>
          <button
            onClick={() => { onRappelsOnly(false); onStatusFilter(statusFilter === "a_appeler" ? "" : "a_appeler"); }}
            className={chip(statusFilter === "a_appeler")}
            style={statusFilter === "a_appeler" ? { background: "#ff7a1a" } : undefined}
          >
            📞 À appeler
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] text-gray-400">
            {leads.length} sur {total} client{total > 1 ? "s" : ""}
          </p>
          <button onClick={props.onToTable} className="text-[11px] font-semibold text-gray-500 underline">
            Voir en tableau
          </button>
        </div>
      </div>

      <div className="space-y-2.5 mt-1">
        {leads.slice(0, limit).map((l) => {
          const tel = telHref(l.phone);
          const time = l.fields[RAPPEL_HEURE_KEY] ?? "";
          const late = !!l.rappelLe && rappelEnRetard(l.rappelLe, time);
          const etape = PIPELINE.find((p) => p.key === l.fields.pipeline);
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
                  <a href={tel} className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-bold text-[#2b5a8f] active:bg-gray-50">
                    <Phone size={16} /> Appeler
                  </a>
                  <a href={whatsappHref(l.phone)} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-bold text-green-600 border-l border-gray-100 active:bg-gray-50">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                </div>
              )}
            </div>
          );
        })}
        {leads.length === 0 && <p className="text-center text-gray-400 text-sm py-10">Aucun client ne correspond.</p>}
        {leads.length > limit && (
          <button onClick={() => setLimit((n) => n + 30)} className="w-full text-sm font-bold text-orange-600 py-3">
            Afficher plus ({leads.length - limit} restants)
          </button>
        )}
      </div>

      {openLead && (
        <LeadScreen
          lead={openLead}
          onClose={() => setOpenId(null)}
          onPatch={props.onPatch}
          onStatus={props.onStatus}
          onNote={props.onNote}
          onChat={props.onChat}
          onFull={props.onFull}
        />
      )}
    </div>
  );
}
