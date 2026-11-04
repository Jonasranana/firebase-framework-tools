import { useEffect, useState } from "react";
import { crmFirestore } from "@/lib/crmDb";

// ─────────────────────────────────────────────────────────────────────────
// Veille quotidienne « Actualités aides » : chaque soir vers 20 h, une
// recherche sur Internet (sites officiels, presse spécialisée) dépose dans
// Firestore crm_news/{AAAA-MM-JJ} le point du jour sur MaPrimeRénov', les
// CEE, la fiche BAR-TH-171 (pompe à chaleur) et le secteur. Page réservée à
// la famille (NEWS_VIEWERS), protégée aussi par la règle Firestore.
// ─────────────────────────────────────────────────────────────────────────
type NewsItem = {
  category?: string;
  title?: string;
  summary?: string;
  impact?: string;
  sourceName?: string;
  url?: string;
  publishedAt?: string;
  importance?: string;
};
type NewsDay = { id: string; date?: string; title?: string; summary?: string; items?: NewsItem[]; nothingNew?: boolean };

const CAT_STYLE: Record<string, string> = {
  "MaPrimeRénov'": "bg-blue-50 text-blue-700 border-blue-200",
  CEE: "bg-amber-50 text-amber-800 border-amber-200",
  "Pompe à chaleur": "bg-emerald-50 text-emerald-700 border-emerald-200",
  Réglementation: "bg-purple-50 text-purple-700 border-purple-200",
};
const SEEN_KEY = "crm-actus-vu";

const frDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

// Nombre de jours d'actualité pas encore ouverts (pastille du menu mobile).
export function useUnreadNews(enabled: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(m.query(m.collection(db, "crm_news"), m.orderBy("date", "desc"), m.limit(10)), (snap: any) => {
          let seen = "";
          try {
            seen = localStorage.getItem(SEEN_KEY) ?? "";
          } catch {}
          setN(snap.docs.filter((d: any) => !d.data().nothingNew && (d.data().date ?? "") > seen).length);
        });
      } catch {
        /* pas d'accès : pas de pastille */
      }
    })();
    return () => unsub?.();
  }, [enabled]);
  return n;
}

export default function ActusCRM() {
  const [days, setDays] = useState<NewsDay[] | null>(null);
  // Jour affiché (par défaut le plus récent) ; « all » = tous les jours à la suite.
  const [pick, setPick] = useState<string>("");
  const [error, setError] = useState("");
  const [seen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.query(m.collection(db, "crm_news"), m.orderBy("date", "desc"), m.limit(60)),
          (snap: any) => {
            const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            setDays(list);
            try {
              if (list[0]?.date) localStorage.setItem(SEEN_KEY, list[0].date);
            } catch {}
          },
          () => setError("Cette page est réservée à Jonas, Alexis, Carole et au compte contact."),
        );
      } catch {
        setError("Chargement impossible. Vérifiez votre connexion.");
      }
    })();
    return () => unsub?.();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-900">📰 Actualités aides</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chaque soir vers 20 h : MaPrimeRénov', primes CEE, fiche pompe à chaleur (BAR-TH-171) et réglementation, avec les sources.
        </p>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}
      {!error && days === null && <p className="text-sm text-gray-400 py-10 text-center">Chargement…</p>}
      {!error && days?.length === 0 && (
        <p className="text-sm text-gray-500 py-10 text-center">La première veille arrivera ce soir vers 20 h.</p>
      )}
      {!!days?.length && (
        <div className="mb-4 -mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto">
          <div className="flex gap-2 w-max pb-1">
            {days.map((d, i) => {
              const on = (pick || days[0].id) === d.id;
              const n = d.items?.length ?? 0;
              const iso = d.date ?? d.id;
              const label =
                i === 0 && iso === new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" })
                  ? "Aujourd'hui"
                  : new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
              return (
                <button
                  key={d.id}
                  onClick={() => setPick(d.id)}
                  className={`shrink-0 text-sm font-semibold rounded-full border px-3 py-1.5 capitalize ${
                    on ? "bg-[#173a5e] border-[#173a5e] text-white" : "bg-white border-gray-200 text-gray-700 hover:border-[#173a5e]"
                  }`}
                >
                  {label} <span className={on ? "text-blue-100" : "text-gray-400"}>· {n}</span>
                </button>
              );
            })}
            {days.length > 1 && (
              <button
                onClick={() => setPick("all")}
                className={`shrink-0 text-sm font-semibold rounded-full border px-3 py-1.5 ${
                  pick === "all" ? "bg-[#173a5e] border-[#173a5e] text-white" : "bg-white border-gray-200 text-gray-700 hover:border-[#173a5e]"
                }`}
              >
                Tout voir
              </button>
            )}
          </div>
        </div>
      )}
      <div className="space-y-5">
        {days?.filter((d) => pick === "all" || d.id === (pick || days[0].id)).map((d) => {
          const isNew = (d.date ?? "") > seen && !d.nothingNew;
          return (
            <section key={d.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <header className="px-4 sm:px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-800 capitalize">{frDate(d.date ?? d.id)}</span>
                {isNew && <span className="text-[11px] font-bold uppercase tracking-wide bg-red-500 text-white rounded-full px-2 py-0.5">Nouveau</span>}
              </header>
              <div className="px-4 sm:px-5 py-4">
                {d.title && <h2 className="text-lg font-extrabold text-gray-900 leading-snug">{d.title}</h2>}
                {d.summary && <p className="text-[15px] text-gray-700 mt-1.5 leading-relaxed whitespace-pre-line">{d.summary}</p>}
                {d.nothingNew && !d.items?.length && (
                  <p className="text-[15px] text-gray-500 mt-1">Rien de nouveau aujourd'hui sur les aides et la pompe à chaleur.</p>
                )}
                <ul className="mt-3 space-y-3">
                  {d.items?.map((it, i) => (
                    <li key={i} className={`rounded-xl border p-3.5 ${it.importance === "haute" ? "border-red-200 bg-red-50/40" : "border-gray-100"}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {it.category && (
                          <span className={`text-[11px] font-bold rounded-full border px-2 py-0.5 ${CAT_STYLE[it.category] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {it.category}
                          </span>
                        )}
                        {it.importance === "haute" && <span className="text-[11px] font-bold text-red-600">⚠️ Important</span>}
                        {it.publishedAt && <span className="text-[11px] text-gray-400">{it.publishedAt}</span>}
                      </div>
                      {it.title && <p className="font-bold text-gray-900 leading-snug">{it.title}</p>}
                      {it.summary && <p className="text-[14px] text-gray-700 mt-1 leading-relaxed">{it.summary}</p>}
                      {it.impact && (
                        <p className="text-[14px] text-[#173a5e] mt-2 bg-blue-50/60 rounded-lg px-2.5 py-1.5">
                          <b>Pour IP5 :</b> {it.impact}
                        </p>
                      )}
                      {it.url && (
                        <a href={it.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[13px] font-semibold text-blue-600 underline underline-offset-2 break-all">
                          Source : {it.sourceName || it.url}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
