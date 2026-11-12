import { useEffect, useMemo, useState } from "react";
import { useLeads } from "@/lib/crmStore";
import { crmFirestore } from "@/lib/crmDb";
import { statusInfo, type Lead } from "@/lib/crm";
import { useColumnsConfig } from "@/lib/crmColumnsConfig";

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
// « Signé en octobre / novembre… » sont des étiquettes ajoutées dans le CRM (clés o_…) : leurs noms
// ne sont connus qu'une fois la configuration du tableau chargée (useColumnsConfig ci-dessous).
const isSigne = (l: Lead) => (l.status as string) === "o_yt99h" || /^sign/i.test(statusInfo(l.status).label ?? "");

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
  // Charge les étiquettes du tableau Pac Pac (noms des statuts ajoutés, ex. « Signé en novembre »).
  const { version: colsVersion } = useColumnsConfig(email, "leads");
  const [[du, au], setPeriode] = useState<[string, string]>(PERIODES[4][1]());
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
    [allLeads, from, to, colsVersion],
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
  // Tous les signés arrivés sur la période, quelle que soit leur source (beaucoup de leads Meta
  // ont été ressaisis à la main ou viennent de l'ancien tableau).
  const tousSignes = useMemo(
    () => (allLeads ?? []).filter((l) => isSigne(l) && Date.parse(l.createdAt) >= from && Date.parse(l.createdAt) < to).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allLeads, from, to, colsVersion],
  );
  const margesTous = tousSignes.map(margeOf);
  const tot = {
    leads: site.ls.length + fb.ls.length,
    signes: tousSignes.length,
    depense: site.depense + fb.depense,
    marge: margesTous.reduce((x, m) => x + (m.marge ?? 0), 0),
    aCompleter: margesTous.filter((m) => m.marge === null).length,
    cee: tousSignes.reduce((x, l) => x + (num(l.fields.primeCee) ?? 0), 0),
    mpr: tousSignes.reduce((x, l) => x + (num(l.fields.mprPraimy) ?? 0), 0),
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

  const ORIGINE: Record<string, string> = { "formulaire-facebook": "📱 Formulaire FB", "saisie-manuelle": "✍️ Saisi à la main", monday: "📋 Ancien tableau" };
  const origine = (l: Lead) => (canalOf(l) === "site" ? "🌐 Site" : ORIGINE[l.source] ?? (l.source || "—"));

  // Résumé mois par mois sur la période : pub, leads Meta, signés, ce qu'on touche, bénéfice.
  const moisListe = useMemo(() => {
    const out: { key: string; label: string; pub: number; leadsMeta: number; leadsCrm: number; signes: number; marge: number }[] = [];
    const d0 = new Date(from), d1 = new Date(to - 1);
    for (let y = d0.getFullYear(), m = d0.getMonth(); y < d1.getFullYear() || (y === d1.getFullYear() && m <= d1.getMonth()); m === 11 ? (y++, (m = 0)) : m++) {
      const a = Math.max(from, new Date(y, m, 1).getTime()), b = Math.min(to, new Date(y, m + 1, 1).getTime());
      const inM = (t: number) => t >= a && t < b;
      const sg = (allLeads ?? []).filter((l) => isSigne(l) && inM(Date.parse(l.createdAt)));
      out.push({
        key: `${y}-${m}`,
        label: new Date(y, m, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        pub: depenses.reduce((x, d) => x + partDans(d, a, b), 0),
        leadsMeta: depenses.filter((d) => inM(dayMs(d.du))).reduce((x, d) => x + (d.leadsMeta ?? 0), 0),
        leadsCrm: (allLeads ?? []).filter((l) => (l.board || "leads") === "leads" && canalOf(l) && inM(Date.parse(l.createdAt))).length,
        signes: sg.length,
        marge: sg.reduce((x, l) => x + (margeOf(l).marge ?? 0), 0),
      });
    }
    return out.reverse();
  }, [allLeads, depenses, from, to, colsVersion]);

  const [voirDepenses, setVoirDepenses] = useState(false);
  const champ = "rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 [color-scheme:light] px-2 py-1.5 text-sm";
  const carte = "rounded-2xl border border-gray-200 bg-white p-4 md:p-5";
  const titre = (t: string, sous?: string) => (
    <div className="mb-3">
      <h2 className="text-base font-black text-gray-900">{t}</h2>
      {sous && <p className="text-xs text-gray-500">{sous}</p>}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">
      {/* 1. En-tête + période */}
      <div className={carte}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-gray-900">💰 Rentabilité Meta</h1>
            <p className="text-xs text-gray-500">Ce que rapportent les pubs Facebook / Instagram · visible seulement par Jonas et Alexis</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIODES.map(([label, f]) => {
              const [a, b] = f();
              return (
                <button key={label} onClick={() => setPeriode([a, b])} className={`rounded-full border px-3 py-1 text-xs font-semibold ${a === du && b === au ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span>Période du</span>
          <input type="date" value={du} onChange={(e) => e.target.value && setPeriode([e.target.value, au])} className={champ} />
          <span>au</span>
          <input type="date" value={au} onChange={(e) => e.target.value && setPeriode([du, e.target.value])} className={champ} />
        </div>
      </div>

      {/* 2. Le résultat en grand */}
      <div className={`rounded-2xl p-5 md:p-6 text-white ${benef >= 0 ? "bg-gradient-to-br from-emerald-600 to-emerald-700" : "bg-gradient-to-br from-red-600 to-red-700"}`}>
        <p className="text-sm font-semibold opacity-90">Bénéfice net après pub</p>
        <p className="text-4xl md:text-5xl font-black mt-1">{eur(benef)}</p>
        <p className="text-sm mt-2 opacity-90">
          On touche <b>{eur(tot.marge)}</b> sur {tot.signes} client{tot.signes > 1 ? "s" : ""} signé{tot.signes > 1 ? "s" : ""} − <b>{eur(tot.depense)}</b> de pub
        </p>
      </div>

      {/* 3. Chiffres clés */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="💸 Pub dépensée" value={eur(tot.depense)} />
        <Kpi label="📥 Leads Meta" value={String(tot.leads)} hint={tot.leads ? `${eur(tot.depense / tot.leads)} par lead` : undefined} />
        <Kpi label="✅ Clients signés" value={String(tot.signes)} hint={tot.leads ? `${Math.round((tot.signes / tot.leads) * 100)} % des leads` : undefined} />
        <Kpi label="💶 On touche" value={eur(tot.marge)} hint={tot.signes ? `${eur(tot.marge / tot.signes)} par client` : undefined} tone="good" />
      </div>
      {tot.aCompleter > 0 && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          ⚠️ {tot.aCompleter} signé{tot.aCompleter > 1 ? "s" : ""} sans montant : pas compté{tot.aCompleter > 1 ? "s" : ""}. Remplis « 🔗 Réf Praimy » ou « 💵 Marge nette » sur la fiche.
        </p>
      )}

      {/* 4. Les clients signés */}
      <div className={carte}>
        {titre("✅ Clients signés et ce qu'on touche", "leads arrivés sur la période, toutes origines")}
        {tousSignes.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun client signé sur cette période. Essaie « Depuis le début ».</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-gray-500 text-xs border-b">
                <tr><th className="text-left py-2 px-1">Client</th><th className="text-left px-1">Arrivé le</th><th className="text-left px-1">Origine</th><th className="text-right px-1">CEE</th><th className="text-right px-1">MaPrimeRénov'</th><th className="text-right px-1">On touche</th></tr>
              </thead>
              <tbody>
                {tousSignes.map((l) => {
                  const m = margeOf(l);
                  return (
                    <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-1"><p className="font-semibold text-gray-900">{l.name}</p><p className="text-xs text-gray-400">{statusInfo(l.status).label}</p></td>
                      <td className="px-1 text-gray-600">{new Date(l.createdAt).toLocaleDateString("fr-FR")}</td>
                      <td className="px-1 text-xs">{origine(l)}</td>
                      <td className="px-1 text-right text-gray-600">{eur(num(l.fields.primeCee))}</td>
                      <td className="px-1 text-right text-gray-600">{eur(num(l.fields.mprPraimy))}</td>
                      <td className="px-1 text-right font-bold">{m.marge === null ? <span className="text-amber-600 font-semibold">à compléter</span> : <span className="text-emerald-700">{eur(m.marge)}{m.calc ? "" : " ✍️"}</span>}</td>
                    </tr>
                  );
                })}
                <tr className="font-black bg-gray-50">
                  <td className="py-2 px-1" colSpan={3}>Total · {tousSignes.length} signé{tousSignes.length > 1 ? "s" : ""}</td>
                  <td className="px-1 text-right">{eur(tot.cee)}</td>
                  <td className="px-1 text-right">{eur(tot.mpr)}</td>
                  <td className="px-1 text-right text-emerald-700">{eur(tot.marge)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-2">On touche = CEE + MaPrimeRénov' nette (− 12 % HT de commission) − {eur(COUT_POSE)} de pose, au moins {eur(MARGE_MIN)} (reste à charge client). ✍️ = saisi à la main.</p>
      </div>

      {/* 5. Mois par mois */}
      <div className={carte}>
        {titre("📅 Mois par mois")}
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="text-gray-500 text-xs border-b">
              <tr><th className="text-left py-2 px-1">Mois</th><th className="text-right px-1">Pub</th><th className="text-right px-1">Leads</th><th className="text-right px-1">Coût / lead</th><th className="text-right px-1">Signés</th><th className="text-right px-1">On touche</th><th className="text-right px-1">Bénéfice</th></tr>
            </thead>
            <tbody>
              {moisListe.map((m) => (
                <tr key={m.key} className="border-b border-gray-100">
                  <td className="py-2 px-1 font-semibold capitalize">{m.label}</td>
                  <td className="px-1 text-right">{eur(m.pub)}</td>
                  <td className="px-1 text-right" title="leads comptés par Meta (leads arrivés dans le CRM)">{m.leadsMeta || m.leadsCrm} <span className="text-gray-400 text-xs">({m.leadsCrm} CRM)</span></td>
                  <td className="px-1 text-right">{m.leadsMeta ? eur(m.pub / m.leadsMeta) : "—"}</td>
                  <td className="px-1 text-right">{m.signes}</td>
                  <td className="px-1 text-right text-emerald-700">{eur(m.marge)}</td>
                  <td className={`px-1 text-right font-bold ${m.marge - m.pub >= 0 ? "text-emerald-600" : "text-red-600"}`}>{eur(m.marge - m.pub)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Site ou formulaire ? */}
      <div className={carte}>
        {titre("🆚 Site ou formulaire Facebook ?", "leads venus directement des pubs, d'après leur source dans le CRM")}
        <div className="grid md:grid-cols-2 gap-3">
          {([["site", site], ["formulaire", fb]] as const).map(([c, r]) => (
            <div key={c} className="rounded-xl border border-gray-200 p-3">
              <p className="font-bold text-gray-900">{CANAUX[c].label}</p>
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div><p className="text-[11px] text-gray-500">Pub</p><p className="font-black">{eur(r.depense)}</p></div>
                <div><p className="text-[11px] text-gray-500">Leads</p><p className="font-black">{r.ls.length}</p></div>
                <div><p className="text-[11px] text-gray-500">Coût / lead</p><p className="font-black">{r.ls.length ? eur(r.depense / r.ls.length) : "—"}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Dépenses (repliées) */}
      <div className={carte}>
        <button onClick={() => setVoirDepenses((v) => !v)} className="w-full flex items-center justify-between text-left">
          <span>
            <span className="text-base font-black text-gray-900">🧾 Dépenses pub enregistrées</span>
            <span className="block text-xs text-gray-500">{depenses.length} lignes · {eur(depenses.reduce((x, d) => x + d.montant, 0))} au total · ajouter une dépense</span>
          </span>
          <span className="text-gray-400 text-sm">{voirDepenses ? "▲ masquer" : "▼ voir"}</span>
        </button>
        {voirDepenses && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <input type="date" value={form.du} onChange={(e) => setForm({ ...form, du: e.target.value })} className={champ} title="Du" />
              <input type="date" value={form.au} onChange={(e) => setForm({ ...form, au: e.target.value })} className={champ} title="Au" />
              <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value as Canal })} className={champ}>
                <option value="site">Site</option><option value="formulaire">Formulaire FB</option>
              </select>
              <input placeholder="Nom de la pub" value={form.campagne} onChange={(e) => setForm({ ...form, campagne: e.target.value })} className={champ} />
              <input placeholder="Montant €" inputMode="decimal" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} className={champ} />
              <button onClick={ajouter} className="rounded-lg bg-gray-900 text-white font-semibold px-3 py-1.5 text-sm">Ajouter</button>
            </div>
            {erreur && <p className="text-sm text-red-600">{erreur}</p>}
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {depenses.map((d) => (
                    <tr key={d.id} className="border-t border-gray-100">
                      <td className="py-1">{d.du === d.au ? new Date(d.du).toLocaleDateString("fr-FR") : `${new Date(d.du).toLocaleDateString("fr-FR")} → ${new Date(d.au).toLocaleDateString("fr-FR")}`}</td>
                      <td>{d.canal === "site" ? "Site" : "Formulaire FB"}</td>
                      <td className="text-gray-500">{d.campagne}</td>
                      <td className="text-right font-semibold">{eur(d.montant)}</td>
                      <td className="text-right text-gray-400">{d.leadsMeta ? `${d.leadsMeta} lead${d.leadsMeta > 1 ? "s" : ""}` : ""}</td>
                      <td className="text-right"><button onClick={() => retirer(d.id)} className="text-gray-400 hover:text-red-600">retirer</button></td>
                    </tr>
                  ))}
                  {depenses.length === 0 && <tr><td className="py-2 text-gray-400">Aucune dépense enregistrée.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
