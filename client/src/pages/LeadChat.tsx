import { useEffect, useMemo, useRef, useState } from "react";
import { Send, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APPEL_SLOTS } from "@/lib/crmColumns";
import { formatDateTime, formatPhone, statusInfo, type Lead, type LeadNote } from "@/lib/crm";

// Prénom lisible à partir d'une adresse e-mail (« jonas.sitbon@… » → « Jonas »).
const authorName = (by: string) => {
  if (!by) return "Inconnu";
  if (by === "automation") return "Automatisation";
  const local = by.split("@")[0].split(/[._-]/)[0];
  return local ? local[0].toUpperCase() + local.slice(1) : by;
};

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const dayLabel = (iso: string) => {
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
const isChat = (n: LeadNote) => (n.kind === undefined || n.kind === "note") && n.by !== "automation";
const isMailReceived = (n: LeadNote) => n.kind === "mail" && n.text.startsWith("📥");

export default function LeadChat({
  lead,
  email,
  onClose,
  onSend,
  onOpenFiche,
}: {
  lead: Lead | null;
  email: string;
  onClose: () => void;
  onSend: (leadId: string, text: string) => Promise<void>;
  onOpenFiche: (leadId: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const count = lead?.notes.length ?? 0;

  const notes = useMemo(
    () => (lead ? [...lead.notes].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)) : []),
    [lead?.notes], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    setText("");
    setError("");
  }, [lead?.id]);

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
  if (lead?.rappelLe) chips.push({ k: "Rappel", v: new Date(lead.rappelLe).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) });
  appels.forEach((s) => chips.push({ k: s.short + " appel", v: lead!.fields[s.key] }));
  const lastSent = [...notes].reverse().find((n) => n.text.startsWith("📤") || n.text.startsWith("✉️"));
  if (lastSent) chips.push({ k: "Dernier mail", v: formatDateTime(lastSent.at) });

  let lastDay = "";
  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0 bg-[#efeae2]" dir="ltr">
        <SheetHeader className="text-left bg-white border-b border-gray-200 px-4 pt-4 pb-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2 pr-6">
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">{lead?.name || "Sans nom"}</SheetTitle>
              <SheetDescription className="text-xs truncate">
                {lead?.phone ? formatPhone(lead.phone) : "Pas de téléphone"}
                {lead?.email ? ` · ${lead.email}` : ""}
              </SheetDescription>
            </div>
            <button
              onClick={() => lead && onOpenFiche(lead.id)}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#2b5a8f] border border-[#2b5a8f]/40 rounded-md px-2 py-1 hover:bg-blue-50"
            >
              <ExternalLink size={12} /> Fiche
            </button>
          </div>
          {/* Petit résumé en lecture seule : on ne modifie rien depuis ici. */}
          <div className="flex flex-wrap gap-1.5">
            {st && (
              <span className="text-[11px] font-bold text-white rounded-full px-2 py-0.5" style={{ background: st.hex }}>
                {st.label}
              </span>
            )}
            {chips.map((c) => (
              <span key={c.k} className="text-[11px] rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">
                <span className="text-gray-400">{c.k} </span>
                <span className="font-semibold">{c.v}</span>
              </span>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {notes.length === 0 && (
            <p className="text-center text-xs text-gray-500 mt-8">Aucun message pour l'instant. Écrivez le premier ci-dessous.</p>
          )}
          {notes.map((n) => {
            const day = dayLabel(n.at);
            const sep =
              day !== lastDay ? (
                <div key={`d-${n.id}`} className="flex justify-center py-1.5">
                  <span className="text-[11px] font-semibold text-gray-600 bg-white/80 rounded-full px-3 py-0.5 shadow-sm">{day}</span>
                </div>
              ) : null;
            lastDay = day;

            // Grande bulle : un message d'équipe ou un mail reçu du client.
            if (isChat(n) || isMailReceived(n)) {
              const mine = isChat(n) && n.by === email;
              const client = isMailReceived(n);
              return (
                <div key={n.id}>
                  {sep}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                        mine
                          ? "bg-[#2b5a8f] text-white rounded-br-sm"
                          : client
                            ? "bg-[#fff1d6] text-gray-900 rounded-bl-sm"
                            : "bg-white text-gray-900 rounded-bl-sm"
                      }`}
                    >
                      {!mine && (
                        <p className={`text-[11px] font-bold mb-0.5 ${client ? "text-[#a35b00]" : "text-[#2b5a8f]"}`}>
                          {client ? `${lead?.name || "Le client"} (mail reçu)` : authorName(n.by)}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{client ? n.text.replace(/^📥\s*Mail reçu\s*—\s*/, "") : n.text}</p>
                      <p className={`text-[10px] mt-0.5 text-right ${mine ? "text-white/70" : "text-gray-400"}`}>{hhmm(n.at)}</p>
                    </div>
                  </div>
                </div>
              );
            }

            // Petite ligne : mise à jour de la ligne, mail/SMS envoyé, automatisation.
            const auto = n.by === "automation";
            return (
              <div key={n.id}>
                {sep}
                <div className="flex justify-center">
                  <p className="max-w-[92%] text-center text-[11px] leading-snug text-gray-600 bg-white/70 rounded-full px-3 py-1 break-words">
                    {auto && !n.text.startsWith("⚡") ? "⚡ " : ""}
                    {n.text.length > 160 ? n.text.slice(0, 160) + "…" : n.text}
                    <span className="text-gray-400">
                      {" "}
                      · {auto ? "Automatisation" : authorName(n.by)} · {hhmm(n.at)}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="bg-white border-t border-gray-200 p-2.5">
          {error && <p className="text-xs text-red-600 mb-1 px-1">{error}</p>}
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
              className="flex-1 resize-none max-h-32 text-sm bg-gray-100 text-gray-900 rounded-2xl px-3.5 py-2 outline-none focus:bg-gray-50 focus:ring-2 focus:ring-[#2b5a8f]/30"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={send}
              disabled={!text.trim() || busy}
              aria-label="Envoyer"
              className="shrink-0 h-9 w-9 rounded-full bg-[#2b5a8f] text-white flex items-center justify-center disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 px-1">Entrée pour envoyer · Maj+Entrée pour aller à la ligne · l'équipe est prévenue par e-mail</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
