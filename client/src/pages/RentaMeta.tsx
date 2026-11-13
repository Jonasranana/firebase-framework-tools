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
// « Site (incomplet) : … » = demande commencée sur la landing des pubs Meta.
const canalOf = (l: Lead): Canal | null =>
  /^site \(incomplet\)/i.test(l.source ?? "") ? "site" : (Object.keys(CANAUX) as Canal[]).find((c) => (CANAUX[c].sources as readonly string[]).includes(l.source)) ?? null;

// Marge d'un signé — barème donné par Alexis (12/11/2026) :
//   CEE touchée : H1 bleu 8 517 €, H1 jaune/violet 4 580 € ; H2 bleu 7 080 €, H2 jaune/violet 3 822 €.
//   MaPrimeRénov' : bleu 5 000 €, jaune 4 000 €, violet (classique) 3 000 €.
//   Frais Praimy : bleu 600 €, jaune 500 €, violet 400 €.
//   Fourni-posé : Praimy 5 800 €, Georges 5 300 € (colonne « Poseur »).
// Marge = CEE + MaPrimeRénov' − frais Praimy − fourni-posé, au moins 2 500 € (reste à charge client).
// « 💵 Marge nette » saisie sur la fiche prend le pas sur ce calcul.
const MARGE_MIN = 2500;
const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const CEE_IP5: Record<string, number> = {
  "H1 bleu": 8517, "H1 jaune": 4580, "H1 classique": 4580,
  "H2 bleu": 7080, "H2 jaune": 3822, "H2 classique": 3822,
};
const MPR_PROFIL: Record<string, number> = { bleu: 5000, jaune: 4000, classique: 3000 };
const FRAIS_PRAIMY: Record<string, number> = { bleu: 600, jaune: 500, classique: 400 };
const POSE = { praimy: 5800, georges: 5300 };
const profilOf = (l: Lead) => String(l.fields.zoneProfil ?? "").split(" ")[1] ?? "";
const estGeorges = (l: Lead) => /georges/i.test(String(l.fields.poseur ?? ""));
const ceeIp5 = (l: Lead): number | null => CEE_IP5[String(l.fields.zoneProfil ?? "")] ?? num(l.fields.primeCee);
const mprOf = (l: Lead): number | null => MPR_PROFIL[profilOf(l)] ?? num(l.fields.mprPraimy);
const fraisOf = (l: Lead): number => (estGeorges(l) ? 0 : FRAIS_PRAIMY[profilOf(l)] ?? 0);
const poseOf = (l: Lead): number => (estGeorges(l) ? POSE.georges : POSE.praimy);
// Ce qu'on touche avec la CEE seule (versée ~1 semaine après la pose) : CEE − fourni-posé.
// Négatif = la CEE ne couvre pas la pose : on attend l'octroi MaPrimeRénov' avant d'installer (on n'avance rien).
const mprRecue = (l: Lead) => l.fields.mprRecue === "oui";
const ceeSeule = (l: Lead): number | null => {
  const cee = ceeIp5(l);
  return cee === null ? null : cee - poseOf(l);
};
function margeOf(l: Lead): { marge: number | null; calc: boolean } {
  const saisie = num(l.fields.margeNette);
  if (saisie !== null) return { marge: saisie, calc: false };
  const cee = ceeIp5(l);
  const mpr = mprOf(l);
  if (cee === null && mpr === null) return { marge: null, calc: true };
  return { marge: Math.max(MARGE_MIN, (cee ?? 0) + (mpr ?? 0) - fraisOf(l) - poseOf(l)), calc: true };
}
// « Signé en octobre / novembre… » sont des étiquettes ajoutées dans le CRM (clés o_…) : leurs noms
// ne sont connus qu'une fois la configuration du tableau chargée (useColumnsConfig ci-dessous).
// Le client vient-il des pubs Meta (lancées début septembre) ? Choix fait sur la page (fields.vientDeMeta
// « oui » / « non »), sinon d'après la source : landing du site ou formulaire Facebook.
const vientDeMeta = (l: Lead) => (l.fields.vientDeMeta === "oui" ? true : l.fields.vientDeMeta === "non" ? false : canalOf(l) !== null);
const isSigne = (l: Lead) => (l.status as string) === "o_yt99h" || /^sign/i.test(String(statusInfo(l.status).label ?? "").trim());

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
  ["Depuis le lancement (1er sept.)", () => ["2026-09-01", today()]],
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
  const signesMeta = tousSignes.filter(vientDeMeta);
  const autresSignes = tousSignes.filter((l) => !vientDeMeta(l));
  const margesTous = signesMeta.map(margeOf);
  const tot = {
    leads: site.ls.length + fb.ls.length,
    signes: signesMeta.length,
    depense: site.depense + fb.depense,
    marge: margesTous.reduce((x, m) => x + (m.marge ?? 0), 0),
    ceeSeule: signesMeta.reduce((x, l) => x + Math.max(0, ceeSeule(l) ?? 0), 0),
    attenteMpr: signesMeta.filter((l) => (ceeSeule(l) ?? 0) < 0 && !mprRecue(l)).length,
    mprRecues: signesMeta.filter(mprRecue).length,
    aCompleter: margesTous.filter((m) => m.marge === null).length,
    cee: signesMeta.reduce((x, l) => x + (ceeIp5(l) ?? 0), 0),
    mpr: signesMeta.reduce((x, l) => x + (mprOf(l) ?? 0), 0),
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
  // Classe un signé « venu de Meta » ou non (enregistré dans la fiche : fields.vientDeMeta).
  // « MPR reçue » : coché à la main quand l'octroi MaPrimeRénov' arrive (par défaut : pas reçue).
  const basculerMpr = async (l: Lead, oui: boolean) => {
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, "crm_leads", l.id), { "fields.mprRecue": oui ? "oui" : "", updatedAt: m.serverTimestamp(), updatedBy: email });
    } catch {
      setErreur("Modification refusée.");
    }
  };
  const basculerMeta = async (l: Lead, oui: boolean) => {
    try {
      const { m, db } = await crmFirestore();
      await m.updateDoc(m.doc(db, "crm_leads", l.id), { "fields.vientDeMeta": oui ? "oui" : "non", updatedAt: m.serverTimestamp(), updatedBy: email });
    } catch {
      setErreur("Modification refusée.");
    }
  };
  const retirer = async (id: string) => {
    if (!window.confirm("Retirer cette dépense ?")) return;
    const { m, db } = await crmFirestore();
    await m.deleteDoc(m.doc(db, "crm_meta_depenses", id));
  };

  const ORIGINE: Record<string, string> = { "formulaire-facebook": "📱 Formulaire Facebook", "saisie-manuelle": "✍️ Saisi à la main", monday: "📋 Ancien tableau Monday", "reactivation-pac": "✉️ Réactivation" };
  const origine = (l: Lead) => (canalOf(l) === "site" ? (/incomplet/i.test(l.source) ? "🌐 Site (incomplet)" : "🌐 Site") : ORIGINE[l.source] ?? (l.source || "—"));

  // Résumé mois par mois sur la période : pub, leads Meta, signés, ce qu'on touche, bénéfice.
  const moisListe = useMemo(() => {
    const out: { key: string; label: string; pub: number; leadsMeta: number; leadsCrm: number; signes: number; marge: number }[] = [];
    const d0 = new Date(from), d1 = new Date(to - 1);
    for (let y = d0.getFullYear(), m = d0.getMonth(); y < d1.getFullYear() || (y === d1.getFullYear() && m <= d1.getMonth()); m === 11 ? (y++, (m = 0)) : m++) {
      const a = Math.max(from, new Date(y, m, 1).getTime()), b = Math.min(to, new Date(y, m + 1, 1).getTime());
      const inM = (t: number) => t >= a && t < b;
      const sg = (allLeads ?? []).filter((l) => isSigne(l) && vientDeMeta(l) && inM(Date.parse(l.createdAt)));
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

  const ligneSigne = (l: Lead) => {
    const m = margeOf(l);
    const compte = vientDeMeta(l);
    return (
      <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
        <td className="py-2.5 px-2"><p className={`font-semibold ${compte ? "text-gray-900" : "text-gray-600"}`}>{l.name}</p><p className="text-xs text-gray-400">{String(statusInfo(l.status).label ?? "").trim()} · arrivé le {new Date(l.createdAt).toLocaleDateString("fr-FR")}</p></td>
        <td className="px-2 text-xs whitespace-nowrap">{origine(l)}</td>
        <td className="px-2 text-right whitespace-nowrap" title={`Prime affichée par Praimy : ${eur(num(l.fields.primeCee))}`}>{eur(ceeIp5(l))}<p className="text-[10px] text-gray-400">{String(l.fields.zoneProfil ?? "").replace("bleu", "grand préc.").replace("jaune", "précaire") || "Praimy"}</p></td>
        <td className="px-2 text-right whitespace-nowrap">
          {eur(mprOf(l))}
          <button onClick={() => basculerMpr(l, !mprRecue(l))} title="Cliquer quand l'octroi MaPrimeRénov' est reçu (ou pour annuler)" className={`mt-0.5 block ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold ${mprRecue(l) ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-white text-gray-500 border-gray-300 hover:bg-gray-100"}`}>
            {mprRecue(l) ? "✅ reçue" : "⏳ pas reçue"}
          </button>
        </td>
        <td className="px-2 text-right whitespace-nowrap">
          {(() => {
            const c = ceeSeule(l);
            if (c === null) return "—";
            if (c >= 0) return <span className="font-bold text-blue-700">{eur(c)}</span>;
            return mprRecue(l) ? (
              <span title="MaPrimeRénov' reçue : le dossier peut être posé." className="inline-block rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-bold">✅ MPR reçue · on peut poser</span>
            ) : (
              <span title="La CEE ne couvre pas la pose : on attend l'octroi MaPrimeRénov' avant d'installer." className="inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-bold">⏳ attend MPR ({eur(c)})</span>
            );
          })()}
        </td>
        <td className="px-2 text-right font-bold whitespace-nowrap">{m.marge === null ? <span className="text-amber-600 font-semibold">à compléter</span> : <span className={compte ? "text-emerald-700" : "text-gray-600"}>{eur(m.marge)}{m.calc ? "" : " ✍️"}</span>}{m.calc && m.marge !== null && <p className="text-[10px] font-normal text-gray-400">− frais {eur(fraisOf(l))} − pose {eur(poseOf(l))}{estGeorges(l) ? " (Georges)" : ""}</p>}</td>
        <td className="px-2 text-right">
          <button onClick={() => basculerMeta(l, !compte)} className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-bold ${compte ? "border-gray-300 text-gray-600 hover:bg-gray-100" : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
            {compte ? "Ne pas compter" : "➕ Vient de la pub"}
          </button>
        </td>
      </tr>
    );
  };
  const enTete = (
    <thead className="text-gray-500 text-xs border-b">
      <tr><th className="text-left py-2 px-2">Client</th><th className="text-left px-2">D'où il vient</th><th className="text-right px-2">CEE (IP5)</th><th className="text-right px-2">MaPrimeRénov'</th><th className="text-right px-2">Avec la CEE seule<span className="block text-[10px] font-normal">1 sem. après la pose</span></th><th className="text-right px-2">On touche (total)</th><th /></tr>
    </thead>
  );

  return (
    <div className="w-full space-y-4 pb-10">
      {/* Période */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-900 px-4 py-3.5 shadow-md">
        <span className="text-base font-black text-white mr-2">📆 Période</span>
        {PERIODES.map(([label, f]) => {
          const [a, b] = f();
          return (
            <button key={label} onClick={() => setPeriode([a, b])} className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${a === du && b === au ? "bg-orange-500 text-white border-orange-500 shadow" : "bg-white/10 text-white border-white/25 hover:bg-white/20"}`}>
              {label}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-2 text-sm font-semibold text-gray-300">
          du <input type="date" value={du} onChange={(e) => e.target.value && setPeriode([e.target.value, au])} className={champ} />
          au <input type="date" value={au} onChange={(e) => e.target.value && setPeriode([du, e.target.value])} className={champ} />
        </span>
      </div>

      {/* Résultat + chiffres clés sur une ligne */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className={`col-span-2 rounded-2xl p-5 text-white ${benef >= 0 ? "bg-gradient-to-br from-emerald-600 to-emerald-700" : "bg-gradient-to-br from-red-600 to-red-700"}`}>
          <p className="text-sm font-semibold opacity-90">Bénéfice net après pub</p>
          <p className="text-4xl font-black mt-1">{eur(benef)}</p>
          <p className="text-xs mt-2 opacity-90">{eur(tot.marge)} touchés − {eur(tot.depense)} de pub</p>
        </div>
        <Kpi label="💸 Pub dépensée" value={eur(tot.depense)} />
        <Kpi label="📥 Leads Meta" value={String(tot.leads)} hint={tot.leads ? `${eur(tot.depense / tot.leads)} par lead` : undefined} />
        <Kpi label="✅ Clients signés" value={String(tot.signes)} hint={tot.leads ? `${Math.round((tot.signes / tot.leads) * 100)} % des leads` : undefined} />
        <Kpi label="💶 On touche" value={eur(tot.marge)} hint={`dont ${eur(tot.ceeSeule)} vite (CEE seule)`} tone="good" />
      </div>
      {tot.aCompleter > 0 && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          ⚠️ {tot.aCompleter} signé{tot.aCompleter > 1 ? "s" : ""} sans montant : pas compté{tot.aCompleter > 1 ? "s" : ""}. Remplis « 🔗 Réf Praimy » ou « 💵 Marge nette » sur la fiche.
        </p>
      )}

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Gauche : 1) clients venus de la pub (comptés), 2) les autres signés (pas comptés) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border-2 border-emerald-300 bg-white p-4 md:p-5">
            <h2 className="text-lg font-black text-emerald-800">📣 Clients venus des pubs Meta</h2>
            <p className="text-sm text-gray-600 mb-3">Ces clients sont arrivés grâce à la pub : <b>ils comptent dans le bénéfice</b>.</p>
            {signesMeta.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun client venu de la pub sur cette période.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  {enTete}
                  <tbody>
                    {signesMeta.map(ligneSigne)}
                    <tr className="font-black bg-emerald-50">
                      <td className="py-2.5 px-2" colSpan={2}>Total · {signesMeta.length} client{signesMeta.length > 1 ? "s" : ""}</td>
                      <td className="px-2 text-right whitespace-nowrap">{eur(tot.cee)}</td>
                      <td className="px-2 text-right whitespace-nowrap">{eur(tot.mpr)}<span className="block text-[10px] font-semibold text-gray-500">{tot.mprRecues}/{signesMeta.length} reçue{tot.mprRecues > 1 ? "s" : ""}</span></td>
                      <td className="px-2 text-right text-blue-700 whitespace-nowrap">{eur(tot.ceeSeule)}{tot.attenteMpr > 0 && <span className="block text-[10px] font-semibold text-amber-700">+ {tot.attenteMpr} en attente MPR</span>}</td>
                      <td className="px-2 text-right text-emerald-700 whitespace-nowrap">{eur(tot.marge)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 p-4 md:p-5">
            <h2 className="text-lg font-black text-gray-700">👥 Autres clients signés</h2>
            <p className="text-sm text-gray-600 mb-3">
              Pas venus de la pub (bouche-à-oreille, ancien fichier, saisis à la main…) : <b>ils ne comptent pas</b> dans le bénéfice.
              Si l'un d'eux vient en fait de la pub, clique sur « ➕ Vient de la pub ».
            </p>
            {autresSignes.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  {enTete}
                  <tbody>{autresSignes.map(ligneSigne)}</tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-400 px-1">On touche = CEE (H1 : bleu 8 517 €, jaune/violet 4 580 € · H2 : bleu 7 080 €, jaune/violet 3 822 €) + MaPrimeRénov' (bleu 5 000 €, jaune 4 000 €, violet 3 000 €) − frais Praimy (600 / 500 / 400 €) − fourni-posé (Praimy 5 800 €, Georges 5 300 €), au moins {eur(MARGE_MIN)} (reste à charge client). ✍️ = saisi à la main.</p>
        </div>

        {/* Droite : mois par mois, site / formulaire, dépenses */}
        <div className="space-y-4">
          <div className={carte}>
            {titre("📅 Mois par mois")}
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs border-b">
                <tr><th className="text-left py-2">Mois</th><th className="text-right">Pub</th><th className="text-right">Leads</th><th className="text-right">Signés</th><th className="text-right">Bénéfice</th></tr>
              </thead>
              <tbody>
                {moisListe.map((m) => (
                  <tr key={m.key} className="border-b border-gray-100">
                    <td className="py-2 font-semibold capitalize">{m.label.replace(/ \d{4}$/, "")}</td>
                    <td className="text-right">{eur(m.pub)}</td>
                    <td className="text-right" title={`${m.leadsCrm} arrivés dans le CRM`}>{m.leadsMeta || m.leadsCrm}</td>
                    <td className="text-right">{m.signes}</td>
                    <td className={`text-right font-bold ${m.marge - m.pub >= 0 ? "text-emerald-600" : "text-red-600"}`}>{eur(m.marge - m.pub)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={carte}>
            {titre("🆚 Site ou formulaire Facebook ?")}
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs border-b">
                <tr><th className="text-left py-2"></th><th className="text-right">Pub</th><th className="text-right">Leads</th><th className="text-right">Coût / lead</th></tr>
              </thead>
              <tbody>
                {([["site", site], ["formulaire", fb]] as const).map(([c, r]) => (
                  <tr key={c} className="border-b border-gray-100">
                    <td className="py-2 font-semibold">{CANAUX[c].label}</td>
                    <td className="text-right">{eur(r.depense)}</td>
                    <td className="text-right">{r.ls.length}</td>
                    <td className="text-right font-bold">{r.ls.length ? eur(r.depense / r.ls.length) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dépenses (repliées) */}
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
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={form.du} onChange={(e) => setForm({ ...form, du: e.target.value })} className={champ} title="Du" />
              <input type="date" value={form.au} onChange={(e) => setForm({ ...form, au: e.target.value })} className={champ} title="Au" />
              <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value as Canal })} className={champ}>
                <option value="site">Site</option><option value="formulaire">Formulaire FB</option>
              </select>
              <input placeholder="Nom de la pub" value={form.campagne} onChange={(e) => setForm({ ...form, campagne: e.target.value })} className={champ} />
              <input placeholder="Montant €" inputMode="decimal" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} className={champ} />
              <button onClick={ajouter} className="col-span-2 rounded-lg bg-gray-900 text-white font-semibold px-3 py-1.5 text-sm">Ajouter</button>
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
      </div>
    </div>
  );
}
