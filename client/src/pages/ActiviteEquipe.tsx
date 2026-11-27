import { useEffect, useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { crmFirestore } from "@/lib/crmDb";
import { useLeads } from "@/lib/crmStore";
import { memberName, useTeam } from "@/lib/crmTeam";

// ─────────────────────────────────────────────────────────────────────────
// « Activité de l'équipe » (Jonas seulement) : qui se connecte au CRM, combien
// de temps, sur quel appareil, sur quelles pages, et combien d'actions sur les
// fiches. Données : crm_activite (voir lib/activite.ts) + notes des fiches.
// ─────────────────────────────────────────────────────────────────────────
type Jour = { id: string; email: string; jour: string; connexions?: number; ordi?: number; tel?: number; minutes?: number; pages?: Record<string, number>; derniere?: { toDate?: () => Date } };

const NOMS_PAGES: Record<string, string> = {
  leads: "Pac Pac",
  praimy: "PRAIMY",
  marges: "Marges",
  bareme: "Barème",
  planning: "Planning",
  loan: "Tournées Loan",
  renta: "Pub Meta",
  stats: "Équipe & leads",
  bets: "BETS",
  documents: "Documents",
  actus: "Actualités",
  corbeille: "Corbeille",
  equipe: "Équipe",
  activite: "Activité",
};
const PERIODES: [string, number][] = [
  ["Aujourd'hui", 1],
  ["7 jours", 7],
  ["30 jours", 30],
];
const jourDe = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const duree = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`);
const ilYa = (d?: Date) => {
  if (!d) return "—";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 2) return "en ce moment";
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.floor(min / 60)} h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

export default function ActiviteEquipe() {
  const [jours, setJours] = useState<Jour[]>([]);
  const [nbJours, setNbJours] = useState(7);
  const [erreur, setErreur] = useState("");
  const { data: leads } = useLeads();
  const equipe = useTeam();

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.collection(db, "crm_activite"),
          (snap: any) => setJours(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))),
          () => setErreur("Lecture refusée."),
        );
      } catch {
        setErreur("Lecture impossible.");
      }
    })();
    return () => unsub?.();
  }, []);

  const debut = jourDe(new Date(Date.now() - (nbJours - 1) * 86400000));
  const derniersJours = useMemo(() => Array.from({ length: Math.min(nbJours, 7) }, (_, i) => jourDe(new Date(Date.now() - i * 86400000))).reverse(), [nbJours]);

  const personnes = useMemo(() => {
    const t = new Map<string, { email: string; connexions: number; minutes: number; ordi: number; tel: number; jours: Set<string>; pages: Record<string, number>; derniere?: Date; parJour: Record<string, number>; actions: number }>();
    const get = (e: string) => {
      const k = e.toLowerCase();
      if (!t.has(k)) t.set(k, { email: k, connexions: 0, minutes: 0, ordi: 0, tel: 0, jours: new Set(), pages: {}, parJour: {}, actions: 0 });
      return t.get(k)!;
    };
    for (const m of equipe ?? []) get(m.email);
    for (const j of jours) {
      if (!j.email || j.jour < debut) continue;
      const p = get(j.email);
      p.connexions += j.connexions ?? 0;
      p.minutes += j.minutes ?? 0;
      p.ordi += j.ordi ?? 0;
      p.tel += j.tel ?? 0;
      if ((j.connexions ?? 0) > 0 || (j.minutes ?? 0) > 0) p.jours.add(j.jour);
      p.parJour[j.jour] = (p.parJour[j.jour] ?? 0) + (j.minutes ?? 0);
      for (const [pg, n] of Object.entries(j.pages ?? {})) p.pages[pg] = (p.pages[pg] ?? 0) + n;
      const d = j.derniere?.toDate?.();
      if (d && (!p.derniere || d > p.derniere)) p.derniere = d;
    }
    // Actions sur les fiches (notes, changements de statut, messages) pendant la période.
    const depuis = new Date(`${debut}T00:00:00`).getTime();
    for (const l of leads ?? []) for (const n of l.notes ?? []) if (n.by && n.by.includes("@") && Date.parse(n.at) >= depuis) get(n.by).actions++;
    return Array.from(t.values()).sort((a, b) => b.minutes - a.minutes || b.actions - a.actions);
  }, [jours, leads, equipe, debut]);

  const total = personnes.reduce((s, p) => s + p.minutes, 0);

  return (
    <div className="max-w-[1400px] mx-auto space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Activité de l'équipe</h1>
          <p className="text-xs text-gray-500">Connexions, temps passé dans le CRM et pages utilisées. Visible seulement par vous.</p>
        </div>
        {PERIODES.map(([l, n]) => (
          <button
            key={l}
            onClick={() => setNbJours(n)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${nbJours === n ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
            style={nbJours === n ? { background: "var(--brand-grad-120)" } : undefined}
          >
            {l}
          </button>
        ))}
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white border border-[#e6eaf2] px-4 py-2.5 shadow-sm">
          <p className="text-xs text-gray-500">Temps total dans le CRM</p>
          <p className="text-2xl font-extrabold text-gray-900">{duree(total)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#e6eaf2] px-4 py-2.5 shadow-sm">
          <p className="text-xs text-gray-500">Personnes actives</p>
          <p className="text-2xl font-extrabold text-gray-900">{personnes.filter((p) => p.minutes > 0 || p.connexions > 0).length}</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#e6eaf2] px-4 py-2.5 shadow-sm">
          <p className="text-xs text-gray-500">Actions sur les fiches</p>
          <p className="text-2xl font-extrabold text-gray-900">{personnes.reduce((s, p) => s + p.actions, 0)}</p>
        </div>
      </div>

      <div className="bg-white border border-[#e6eaf2] rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-[#f7f9fc] [&>th]:py-2.5 [&>th]:px-3 [&>th]:text-left">
              <th>Personne</th>
              <th className="!text-right">Temps</th>
              <th className="!text-right">Connexions</th>
              <th className="!text-right">Jours actifs</th>
              <th>Appareil</th>
              <th className="!text-right">Actions fiches</th>
              <th>Pages les plus utilisées</th>
              <th>Dernière activité</th>
            </tr>
          </thead>
          <tbody>
            {personnes.map((p) => {
              const pages = (Object.entries(p.pages) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 4);
              const actif = p.minutes > 0 || p.connexions > 0;
              return (
                <tr key={p.email} className={`border-t border-gray-100 [&>td]:py-2.5 [&>td]:px-3 ${actif ? "" : "text-gray-400"}`}>
                  <td>
                    <p className="font-bold text-gray-900">{memberName(p.email, p.email.split("@")[0])}</p>
                    <p className="text-[11px] text-gray-400">{p.email}</p>
                  </td>
                  <td className="text-right font-extrabold text-[#1f4b7f] whitespace-nowrap">{p.minutes ? duree(p.minutes) : "—"}</td>
                  <td className="text-right font-semibold">{p.connexions || "—"}</td>
                  <td className="text-right">{p.jours.size || "—"}</td>
                  <td className="whitespace-nowrap text-xs text-gray-600">
                    {p.ordi > 0 && (
                      <span className="inline-flex items-center gap-1 mr-2">
                        <Monitor size={13} /> {p.ordi}
                      </span>
                    )}
                    {p.tel > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Smartphone size={13} /> {p.tel}
                      </span>
                    )}
                    {!p.ordi && !p.tel && "—"}
                  </td>
                  <td className="text-right font-semibold">{p.actions || "—"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {pages.length
                        ? pages.map(([pg, n]) => (
                            <span key={pg} className="rounded-full bg-[#edf2f8] px-2 py-0.5 text-[11px] font-semibold text-[#1f4b7f]">
                              {NOMS_PAGES[pg] ?? pg} · {duree(n)}
                            </span>
                          ))
                        : <span className="text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-xs text-gray-600">{actif ? ilYa(p.derniere) : "pas encore connecté"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nbJours > 1 && (
        <div className="bg-white border border-[#e6eaf2] rounded-2xl shadow-sm overflow-x-auto">
          <p className="px-4 pt-3 text-sm font-extrabold text-gray-900">Temps passé jour par jour</p>
          <table className="w-full text-sm mt-1">
            <thead>
              <tr className="text-[11px] text-gray-500 [&>th]:py-2 [&>th]:px-3">
                <th className="text-left">Personne</th>
                {derniersJours.map((j) => (
                  <th key={j} className="text-right capitalize">
                    {new Date(`${j}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personnes
                .filter((p) => p.minutes > 0)
                .map((p) => (
                  <tr key={p.email} className="border-t border-gray-100 [&>td]:py-2 [&>td]:px-3">
                    <td className="font-semibold text-gray-800">{memberName(p.email, p.email.split("@")[0])}</td>
                    {derniersJours.map((j) => (
                      <td key={j} className={`text-right ${p.parJour[j] ? "font-semibold text-gray-900" : "text-gray-300"}`}>
                        {p.parJour[j] ? duree(p.parJour[j]) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-400">
        Le temps compte les minutes où le CRM est ouvert et visible à l'écran. Les connexions et le temps sont suivis à partir de cette mise à jour ; les actions
        sur les fiches (notes, statuts, messages) remontent plus loin.
      </p>
    </div>
  );
}
