import Avatar from "@/components/Avatar";
import { useTeam } from "@/lib/crmTeam";
import { markAllNotifsRead, markNotifRead, notifTime, useNotifs, type CrmNotif } from "@/lib/crmNotifs";

// Liste « 🔔 Notifs » : une ligne par notification (titre, message, heure exacte), petite photo
// à droite (la personne qui a écrit, sinon une icône selon le type). Les non lues sont en bleu.
const ICONS: Record<string, { emoji: string; bg: string }> = {
  leads: { emoji: "📥", bg: "bg-emerald-100" },
  rappels: { emoji: "⏰", bg: "bg-amber-100" },
  messages: { emoji: "💬", bg: "bg-sky-100" },
  tags: { emoji: "🏷️", bg: "bg-violet-100" },
  planning: { emoji: "🗓️", bg: "bg-orange-100" },
};

export default function NotifsFeed({ onOpen, compact }: { onOpen: (n: CrmNotif) => void; compact?: boolean }) {
  const { items, unread, loaded } = useNotifs();
  const team = useTeam();

  return (
    <div className="text-left" dir="ltr">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <p className="font-extrabold text-gray-900">
          Notifications {unread > 0 && <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">{unread}</span>}
        </p>
        {unread > 0 && (
          <button onClick={markAllNotifsRead} className="text-xs font-semibold text-sky-700 hover:underline">
            Tout marquer comme lu
          </button>
        )}
      </div>
      {!loaded && <p className="px-1 py-6 text-center text-sm text-gray-400">Chargement…</p>}
      {loaded && items.length === 0 && <p className="px-1 py-6 text-center text-sm text-gray-400">Aucune notification pour l'instant.</p>}
      <div className={`divide-y divide-gray-100 ${compact ? "max-h-[60vh] overflow-y-auto" : ""}`}>
        {items.map((n) => {
          const who = n.by ? team?.find((m) => m.email === n.by.toLowerCase()) : undefined;
          const icon = ICONS[n.kind] ?? { emoji: "🔔", bg: "bg-gray-100" };
          return (
            <button
              key={n.id}
              onClick={() => {
                if (!n.read) markNotifRead(n.id);
                onOpen(n);
              }}
              className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-3 text-left transition-colors ${n.read ? "hover:bg-gray-50" : "bg-sky-50 hover:bg-sky-100"}`}
            >
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-sky-500"}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] leading-snug ${n.read ? "font-semibold text-gray-800" : "font-extrabold text-gray-900"}`}>{n.title}</span>
                {n.body && <span className="mt-0.5 block whitespace-pre-line text-[13px] leading-snug text-gray-600 line-clamp-3">{n.body}</span>}
                <span className={`mt-1 block text-[12px] font-semibold ${n.read ? "text-gray-400" : "text-sky-700"}`}>{notifTime(n.at)}</span>
              </span>
              <span className="shrink-0">
                {who ? (
                  <Avatar name={who.name} photoUrl={who.photoUrl} size={44} />
                ) : (
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${icon.bg}`}>{icon.emoji}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
