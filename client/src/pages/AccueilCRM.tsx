import { useMemo } from "react";
import { Loader2, Mail, Phone } from "lucide-react";
import { useLeads } from "@/lib/crmStore";
import { isClosedStatus, LOST_STATUSES, statusInfo, telHref, todayYmd, type Lead } from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// Accueil du CRM : ce qu'il faut faire aujourd'hui (rappels en retard et du
// jour, mails clients non lus, nouveaux leads, leads sans nouvelle).
// ─────────────────────────────────────────────────────────────────────────
const DAY = 86400000;

const Tile = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
    <p className="text-xs font-semibold text-gray-500">{label}</p>
    <p className={`text-3xl font-extrabold mt-1 ${tone ?? "text-gray-900"}`}>{value}</p>
  </div>
);

function Row({ lead, extra, onOpen }: { lead: Lead; extra?: string; onOpen: () => void }) {
  const st = statusInfo(lead.status);
  return (
    <div className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0">
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className="text-sm font-semibold text-gray-900 truncate">{lead.name || "Sans nom"}</div>
        <div className="text-xs text-gray-500 truncate">
          {extra ? `${extra} · ` : ""}
          {lead.city || lead.postalCode}
        </div>
      </button>
      <span className="text-[11px] font-semibold text-white rounded px-2 py-0.5 shrink-0" style={{ background: st.hex }}>
        {st.label}
      </span>
      {telHref(lead.phone) && (
        <a href={telHref(lead.phone)} aria-label="Appeler" className="shrink-0 p-1.5 rounded-full bg-[#2b5a8f] text-white">
          <Phone size={14} />
        </a>
      )}
    </div>
  );
}

const Card = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
  <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
    <h3 className="text-sm font-bold text-gray-800 mb-1">
      {title} <span className="text-gray-400 font-normal">({count})</span>
    </h3>
    {count === 0 ? <p className="text-sm text-gray-400 py-3">Rien à signaler 🎉</p> : children}
  </section>
);

export default function AccueilCRM({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const { data: leads, error } = useLeads();
  const today = todayYmd();

  const d = useMemo(() => {
    const all = (leads ?? []).filter((l) => !isClosedStatus(l.status) && !LOST_STATUSES.includes(l.status));
    const late = all.filter((l) => l.rappelLe && l.rappelLe < today).sort((a, b) => a.rappelLe.localeCompare(b.rappelLe));
    const now = all.filter((l) => l.rappelLe === today);
    const unread = (leads ?? []).filter((l) => l.mailNonLu);
    const week = Date.now() - 7 * DAY;
    const fresh = (leads ?? [])
      .filter((l) => l.createdAt && Date.parse(l.createdAt) > week)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const month = Date.now() - 14 * DAY;
    const stale = all
      .filter((l) => !l.rappelLe && l.updatedAt && Date.parse(l.updatedAt) < month && ["interesse", "rappel_demande", "rdv_pris"].includes(l.status))
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    return { late, now, unread, fresh, stale };
  }, [leads, today]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!leads) return <Loader2 className="animate-spin text-gray-400 mx-auto my-10" />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold text-gray-900">Bonjour 👋 voici votre journée</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Rappels en retard" value={d.late.length} tone={d.late.length ? "text-red-600" : undefined} />
        <Tile label="Rappels aujourd'hui" value={d.now.length} tone="text-[#2b5a8f]" />
        <Tile label="Mails clients non lus" value={d.unread.length} tone={d.unread.length ? "text-[#579bfc]" : undefined} />
        <Tile label="Nouveaux leads (7 j)" value={d.fresh.length} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="⏰ Rappels en retard" count={d.late.length}>
          {d.late.slice(0, 15).map((l) => (
            <Row key={l.id} lead={l} extra={`prévu le ${l.rappelLe.split("-").reverse().join("/")}`} onOpen={() => onOpenLead(l.id)} />
          ))}
        </Card>
        <Card title="📞 À rappeler aujourd'hui" count={d.now.length}>
          {d.now.slice(0, 15).map((l) => (
            <Row key={l.id} lead={l} onOpen={() => onOpenLead(l.id)} />
          ))}
        </Card>
        <Card title="✉️ Clients qui ont répondu" count={d.unread.length}>
          {d.unread.slice(0, 15).map((l) => (
            <Row key={l.id} lead={l} extra="a répondu par mail" onOpen={() => onOpenLead(l.id)} />
          ))}
        </Card>
        <Card title="🆕 Nouveaux leads" count={d.fresh.length}>
          {d.fresh.slice(0, 15).map((l) => (
            <Row key={l.id} lead={l} extra={l.source} onOpen={() => onOpenLead(l.id)} />
          ))}
        </Card>
        <Card title="💤 Sans nouvelle depuis 14 jours (intéressés, RDV…)" count={d.stale.length}>
          {d.stale.slice(0, 15).map((l) => (
            <Row key={l.id} lead={l} onOpen={() => onOpenLead(l.id)} />
          ))}
        </Card>
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Mail size={12} /> Cliquez sur un nom pour ouvrir la fiche, sur le téléphone pour appeler.
      </p>
    </div>
  );
}
