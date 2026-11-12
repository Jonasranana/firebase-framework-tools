import { useEffect, useMemo, useState } from "react";
import { useLeads } from "@/lib/crmStore";
import { crmFirestore } from "@/lib/crmDb";
import { statusInfo, type Lead } from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// « Rentabilité Meta » : réservée à Jonas et Alexis (RENTA_VIEWERS + règle
// Firestore crm_meta_depenses). Leads venus des pubs Meta (site + formulaire
// Facebook), dépense pub saisie depuis les captures Ads Manager, clients
// signés et bénéfice net = marge des signés − dépense pub, sur la période choisie.
// ─────────────────────────────────────────────────────────────────────────

const CANAUX = {
  site: { label: "🌐 Site (landing)", sources: ["landing-pac-meta", "landing-pac-meta-rappel", "simulateur-landing"] },
  formulaire: { label: "📱 Formulaire Facebook", sources: ["formulaire-facebook"] },
} as const;
type Canal = keyof typeof CANAUX;
const canalOf = (l: Lead): Canal | null =>
  (Object.keys(CANAUX) as Canal[]).find((c) => (CANAUX[c].sources as readonly string[]).includes(l.source)) ?? null;

// Marge d'un signé (barème Prémi, comme « Marges PRAIMY ») : CEE + MaPrimeRénov' nette de la commission
// (12 % HT + TVA) − fourniture-pose ; le reste à charge client remonte la marge à 2 500 € minimum.
// « 💵 Marge nette » saisie sur la fiche prend le pas sur ce calcul.
const COUT_POSE = 5700;
const MARGE_MIN = 2500;
const TAUX_NET_MPR = 1 - 0.12 * 1.2;
const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
function margeOf(l: Lead): { marge: number | null; calc: boolean } {
  const saisie = num(l.fields.margeNette);
  if (saisie !== null) return { marge: saisie, calc: false };
  const cee = num(l.fields.primeCee);
  const mpr = num(l.fields.mprPraimy);
  if (cee === null && mpr === null) return { marge: null, calc: true };
  return { marge: Math.max(MARGE_MIN, (cee ?? 0) + (mpr ?? 0) * TAUX_NET_MPR - COUT_POSE), calc: true };
}
const isSigne = (l: Lead) => /sign/i.test(statusInfo(l.status).label ?? "");

type Depense = { id: string; du: string; au: string; canal: Canal; campagne: string; montant: number; leadsMeta?: number };
const DAY = 86400000;
const dayMs = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
// Part d'une dépense qui tombe dans la période (au prorata des jours).
const partDans = (d: Depense, from: number, to: number) => {
  const a = dayMs(d.du), b = dayMs(d.au) + DAY;
  const jours = Math.max(1, (b - a) / DAY);
  const recouvre = Math.max(0, Math.min(b, to) - Math.max(a, from)) / DAY;
  return (d.montant * recouvre) / jours;
};

const eur = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : `${Math.round(n).toLocaleString("fr-FR")} €`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const today = () => iso(Date.now());
const PERIODES: [string, () => [string, string]][] = [
  ["7 jours", () => [iso(Date.now() - 6 * DAY), today()]],
  ["30 jours", () => [iso(Date.now() - 29 * DAY), today()]],
  ["Ce mois", () => [today().slice(0, 8) + "01", today()]],
  ["Mois dernier", () => {
    const d = new Date(); const a = new Date(d.getFullYear(), d.getMonth() - 1, 1); const b = new Date(d.getFullYear(), d.getMonth(), 0);
    return [`${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-01`, `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, "0")}-${String(b.getDate()).padStart(2, "0")}`];
  }],
  ["Depuis le début", () => ["2026-01-01", today()]],
];

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function RentaMeta({ email }: { email: string }) {
  const { data: allLeads } = useLeads();
  const [[du, au], setPeriode] = useState<[string, string]>(PERIODES[1][1]());
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [erreur, setErreur] = useState("");
  const [form, setForm] = useState({ du: "", au: "", canal: "site" as Canal, campagne: "", montant: "", leadsMeta: "" });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.collection(db, "crm_meta_depenses"),
          (snap: any) => setDepenses(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).sort((a: Depense, b: Depense) => b.du.localeCompare(a.du))),
          () => setErreur("Dépenses illisibles (accès refusé)."),
        );
      } catch {
        setErreur("Dépenses illisibles.");
      }
    })();
    return () => unsub?.();
  }, []);

  const from = dayMs(du), to = dayMs(au) + DAY;
  const leads = useMemo(
    () => (allLeads ?? []).filter((l) => (l.board || "leads") === "leads" && canalOf(l) && Date.parse(l.createdAt) >= from && Date.parse(l.createdAt) < to),
    [allLeads, from, to],
  );
  const parCanal = (c: Canal) => {
    const ls = leads.filter((l) => canalOf(l) === c);
    const signes = ls.filter(isSigne);
    const depense = depenses.filter((d) => d.canal === c).reduce((s, d) => s + partDans(d, from, to), 0);
    const marges = signes.map(margeOf);
    const marge = marges.reduce((s, x) => s + (x.marge ?? 0), 0);
    return { ls, signes, depense, marge, aCompleter: marges.filter((x) => x.marge === null).length };
  };
  const site = parCanal("site"), fb = parCanal("formulaire");
  const tot = {
    leads: site.ls.length + fb.ls.length,
    signes: site.signes.length + fb.signes.length,
    depense: site.depense + fb.depense,
    marge: site.marge + fb.marge,
    aCompleter: site.aCompleter + fb.aCompleter,
  };
  const benef = tot.marge - tot.depense;

  const ajouter = async () => {
    const montant = num(form.montant);
    if (!form.du || !form.au || montant === null) return setErreur("Remplis les dates et le montant.");
    try {
      const { m, db } = await crmFirestore();
      await m.addDoc(m.collection(db, "crm_meta_depenses"), {
        du: form.du, au: form.au, canal: form.canal, campagne: form.campagne.trim(), montant,
        ...(num(form.leadsMeta) !== null ? { leadsMeta: num(form.leadsMeta) } : {}),
        createdBy: email, createdAt: m.serverTimestamp(),
      });
      setForm({ du: "", au: "", canal: form.canal, campagne: "", montant: "", leadsMeta: "" });
      setErreur("");
    } catch {
      setErreur("Enregistrement refusé.");
    }
  };
  const retirer = async (id: string) => {
    if (!window.confirm("Retirer cette dépense ?")) return;
    const { m, db } = await crmFirestore();
    await m.deleteDoc(m.doc(db, "crm_meta_depenses", id));
  };

  const signesListe = [...site.signes, ...fb.signes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-black text-gray-900">💰 Rentabilité Meta</h1>
        <p className="text-sm text-gray-500">Leads des pubs Meta (site + formulaire Facebook), dépense pub et bénéfice net après pub. Visible seulement par Jonas et Alexis.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODES.map(([label, f]) => {
          const [a, b] = f();
          return (
            <button key={label} onClick={() => setPeriode([a, b])} className={`rounded-full border px-3 py-1 text-sm font-semibold ${a === du && b === au ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300"}`}>
              {label}
            </button>
          );
        })}
        <span className="text-sm text-gray-500 ml-1">du</span>
        <input type="date" value={du} onChange={(e) => e.target.value && setPeriode([e.target.value, au])} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
        <span className="text-sm text-gray-500">au</span>
        <input type="date" value={au} onChange={(e) => e.target.value && setPeriode([du, e.target.value])} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Dépense pub Meta" value={eur(tot.depense)} hint="d'après les captures saisies" />
        <Kpi label="Leads Meta" value={String(tot.leads)} hint={tot.leads ? `${eur(tot.depense / tot.leads)} par lead` : undefined} />
        <Kpi label="Clients signés" value={String(tot.signes)} hint={tot.signes ? `${eur(tot.depense / tot.signes)} de pub par signé` : undefined} />
        <Kpi label="Bénéfice net après pub" value={eur(benef)} hint={`marge ${eur(tot.marge)} − pub ${eur(tot.depense)}`} tone={benef >= 0 ? "good" : "bad"} />
      </div>
      {tot.aCompleter > 0 && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          ⚠️ {tot.aCompleter} signé(s) sans montant : leur marge n'est pas comptée. Remplis « 🔗 Réf Praimy » ou « 💵 Marge nette » sur leur fiche.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left p-3">Canal</th><th className="text-right p-3">Dépense</th><th className="text-right p-3">Leads</th><th className="text-right p-3">Coût / lead</th>
              <th className="text-right p-3">Signés</th><th className="text-right p-3">Taux</th><th className="text-right p-3">Marge</th><th className="text-right p-3">Bénéfice net</th>
            </tr>
          </thead>
          <tbody>
            {([["site", site], ["formulaire", fb]] as const).map(([c, r]) => (
              <tr key={c} className="border-t">
                <td className="p-3 font-semibold">{CANAUX[c].label}</td>
                <td className="p-3 text-right">{eur(r.depense)}</td>
                <td className="p-3 text-right">{r.ls.length}</td>
                <td className="p-3 text-right">{r.ls.length ? eur(r.depense / r.ls.length) : "—"}</td>
                <td className="p-3 text-right">{r.signes.length}</td>
                <td className="p-3 text-right">{r.ls.length ? `${Math.round((r.signes.length / r.ls.length) * 100)} %` : "—"}</td>
                <td className="p-3 text-right">{eur(r.marge)}</td>
                <td className={`p-3 text-right font-bold ${r.marge - r.depense >= 0 ? "text-emerald-600" : "text-red-600"}`}>{eur(r.marge - r.depense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-bold text-gray-900">✅ Signés venus de Meta sur la période</h2>
        {signesListe.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">Aucun signé parmi les leads Meta arrivés sur cette période.</p>
        ) : (
          <table className="w-full text-sm mt-2">
            <thead className="text-gray-500 text-xs"><tr><th className="text-left py-1">Client</th><th className="text-left">Arrivé le</th><th className="text-left">Canal</th><th className="text-right">CEE</th><th className="text-right">MPR</th><th className="text-right">Marge</th></tr></thead>
            <tbody>
              {signesListe.map((l) => {
                const m = margeOf(l);
                return (
                  <tr key={l.id} className="border-t">
                    <td className="py-1.5">{l.name}</td>
                    <td>{new Date(l.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td>{canalOf(l) === "site" ? "Site" : "Formulaire FB"}</td>
                    <td className="text-right">{eur(num(l.fields.primeCee))}</td>
                    <td className="text-right">{eur(num(l.fields.mprPraimy))}</td>
                    <td className="text-right font-semibold">{m.marge === null ? <span className="text-amber-600">à compléter</span> : `${eur(m.marge)}${m.calc ? "" : " ✍️"}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Marge = CEE + MaPrimeRénov' nette (− 12 % HT de commission) − {eur(COUT_POSE)} de fourniture-pose, au moins {eur(MARGE_MIN)} (reste à charge client). ✍️ = marge saisie à la main.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-bold text-gray-900">📊 Dépenses pub (captures Ads Manager)</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
          <input type="date" value={form.du} onChange={(e) => setForm({ ...form, du: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1.5" title="Du" />
          <input type="date" value={form.au} onChange={(e) => setForm({ ...form, au: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1.5" title="Au" />
          <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value as Canal })} className="rounded-lg border border-gray-300 px-2 py-1.5">
            <option value="site">Site</option><option value="formulaire">Formulaire FB</option>
          </select>
          <input placeholder="Nom de la pub" value={form.campagne} onChange={(e) => setForm({ ...form, campagne: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1.5" />
          <input placeholder="Montant €" inputMode="decimal" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1.5" />
          <button onClick={ajouter} className="rounded-lg bg-gray-900 text-white font-semibold px-3 py-1.5">Ajouter</button>
        </div>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <table className="w-full text-sm">
          <tbody>
            {depenses.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="py-1.5">{new Date(d.du).toLocaleDateString("fr-FR")} → {new Date(d.au).toLocaleDateString("fr-FR")}</td>
                <td>{d.canal === "site" ? "Site" : "Formulaire FB"}</td>
                <td className="text-gray-500">{d.campagne}</td>
                <td className="text-right font-semibold">{eur(d.montant)}</td>
                <td className="text-right text-gray-400">{d.leadsMeta !== undefined ? `${d.leadsMeta} leads Meta` : ""}</td>
                <td className="text-right"><button onClick={() => retirer(d.id)} className="text-xs text-gray-400 hover:text-red-600">retirer</button></td>
              </tr>
            ))}
            {depenses.length === 0 && <tr><td className="py-2 text-gray-400">Aucune dépense saisie pour l'instant.</td></tr>}
          </tbody>
        </table>
        <p className="text-xs text-gray-400">Une dépense sur plusieurs jours est répartie au prorata des jours de la période affichée.</p>
      </div>
    </div>
  );
}
