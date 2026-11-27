import { useEffect, useMemo, useState } from "react";
import { useLeads } from "@/lib/crmStore";
import { crmFirestore } from "@/lib/crmDb";
import { statusInfo, type Lead } from "@/lib/crm";
import { useColumnsConfig } from "@/lib/crmColumnsConfig";
import { lireExportMeta, idMetaJour, type MetaJour } from "@/lib/metaExport";
import { MARGE_MIN, num, ceeIp5, mprOf, poseOf, fraisOf, mprRecue, ceeSeule, margeOf, isSigne, moisSigne } from "@/lib/chantiers";

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
  /^site \(incomplet\)/i.test(l.source ?? "") && !/whatsapp|reactivation/i.test(l.source ?? "") ? "site" : (Object.keys(CANAUX) as Canal[]).find((c) => (CANAUX[c].sources as readonly string[]).includes(l.source)) ?? null;

// Fines lignes verticales entre les colonnes des tableaux (pas avant la 1re colonne).
const lignesCol = "[&_th]:border-l [&_td]:border-l [&_th:first-child]:border-l-0 [&_td:first-child]:border-l-0 [&_th]:border-gray-200 [&_td]:border-gray-200";
// « Signé en octobre / novembre… » sont des étiquettes ajoutées dans le CRM (clés o_…) : leurs noms
// ne sont connus qu'une fois la configuration du tableau chargée (useColumnsConfig ci-dessous).
// Le client vient-il des pubs Meta (lancées début septembre) ? Choix fait sur la page (fields.vientDeMeta
// « oui » / « non »), sinon d'après la source : landing du site ou formulaire Facebook.
const vientDeMeta = (l: Lead) => (l.fields.vientDeMeta === "oui" ? true : l.fields.vientDeMeta === "non" ? false : canalOf(l) !== null);

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
    <div className="rounded-2xl border border-[#e6eaf2] bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-black ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-gray-900"}`}>{value}</p>
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
  // Compteur anonyme du formulaire du site (site_entonnoir/<jour>) : combien de visiteurs voient chaque étape.
  const [entonnoir, setEntonnoir] = useState<{ id: string; data: Record<string, Record<string, number>> }[]>([]);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.collection(db, "site_entonnoir"),
          (snap: any) => setEntonnoir(snap.docs.map((d: any) => ({ id: d.id, data: d.data() }))),
          () => {},
        );
      } catch {
        /* pas encore de compteur */
      }
    })();
    return () => unsub?.();
  }, []);
  const [form, setForm] = useState({ du: "", au: "", canal: "site" as Canal, campagne: "", montant: "", leadsMeta: "" });
  // Export Meta jour par jour (crm_meta_jours) : prioritaire sur les dépenses saisies à la main.
  const [jours, setJours] = useState<MetaJour[]>([]);
  const [importMsg, setImportMsg] = useState("");
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.collection(db, "crm_meta_jours"),
          (snap: any) => setJours(snap.docs.map((d: any) => d.data() as MetaJour)),
          () => {},
        );
      } catch {
        /* pas encore d'export importé */
      }
    })();
    return () => unsub?.();
  }, []);
  const dernierJour = jours.reduce((x, j) => (j.jour > x ? j.jour : x), "");
  // Dépense pub entre deux instants : export Meta jusqu'au dernier jour importé, saisies à la main après.
  const pubEntre = (a: number, b: number, canal?: Canal) => {
    const exp = jours.filter((j) => j.canal !== "autre" && (!canal || j.canal === canal) && dayMs(j.jour) >= a && dayMs(j.jour) < b).reduce((x, j) => x + j.depense, 0);
    const apres = dernierJour ? Math.max(a, dayMs(dernierJour) + DAY) : a;
    const main = apres < b ? depenses.filter((d) => !canal || d.canal === canal).reduce((x, d) => x + partDans(d, apres, b), 0) : 0;
    return exp + main;
  };
  const importer = async (f: File) => {
    setImportMsg("Lecture du fichier…");
    try {
      const lignes = lireExportMeta(await f.text());
      if (!lignes.length) return setImportMsg("Aucune ligne jour par jour trouvée. Dans Meta : Exporter avec la répartition « Jour ».");
      const { m, db } = await crmFirestore();
      for (let i = 0; i < lignes.length; i += 400) {
        const b = m.writeBatch(db);
        for (const l of lignes.slice(i, i + 400)) b.set(m.doc(db, "crm_meta_jours", idMetaJour(l)), { ...l, importePar: email, importeLe: m.serverTimestamp() });
        await b.commit();
      }
      const fin = lignes.reduce((x, l) => (l.jour > x ? l.jour : x), "");
      setImportMsg(`✅ ${lignes.length} lignes importées, jusqu'au ${new Date(`${fin}T12:00:00`).toLocaleDateString("fr-FR")}.`);
    } catch (e: any) {
      setImportMsg(`❌ ${e?.message || "Import impossible."}`);
    }
  };

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
    const depense = pubEntre(from, to, c);
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
  // Entonnoir du formulaire sur la période (toutes sources du site, hors réactivation).
  const ETAPES_FORM: [string, string][] = [["arrivee", "Arrivent sur le simulateur"], ["q1", "Maison ou appartement"], ["q2", "Propriétaire"], ["q3", "Surface"], ["coordonnees", "Coordonnées"], ["q4", "Chauffage"], ["q5", "Département / adresse"], ["q6", "Foyer"], ["q7", "Revenus"], ["q8", "Échéance"], ["resultat", "Voient leur résultat"]];
  const vus = (() => {
    const t: Record<string, number> = {};
    for (const j of entonnoir) {
      if (j.id < du || j.id > au) continue;
      for (const [src, c] of Object.entries(j.data)) {
        if (src.startsWith("reactivation")) continue;
        for (const [k, n] of Object.entries(c ?? {})) t[k] = (t[k] ?? 0) + (Number(n) || 0);
      }
    }
    return t;
  })();
  // Quelle annonce amène des clients : leads du site rangés par pub d'origine (paramètres utm du lien Meta).
  const parPub = useMemo(() => {
    const m = new Map<string, { leads: number; avancent: number; signes: number; campagne: string }>();
    for (const l of leads) {
      if (canalOf(l) !== "site") continue;
      const k = l.fields.pubAnnonce || "";
      const e = m.get(k) ?? { leads: 0, avancent: 0, signes: 0, campagne: l.fields.pubCampagne || "" };
      e.leads++;
      if (isSigne(l)) e.signes++;
      else if (/interesse|rdv|propal|proposition|qualifi|docs|vt|en_cours|traitement/.test(String(l.status))) e.avancent++;
      m.set(k, e);
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1) || b[1].signes - a[1].signes || b[1].leads - a[1].leads);
  }, [leads]);

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

  const ORIGINE: Record<string, string> = { "formulaire-facebook": "📱 Formulaire Facebook", "saisie-manuelle": "💡 Ancien client LED", monday: "📋 Ancien tableau Monday", "reactivation-pac": "✉️ Réactivation" };
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
        pub: pubEntre(a, b),
        leadsMeta: jours.length ? jours.filter((j) => j.canal !== "autre" && inM(dayMs(j.jour))).reduce((x, j) => x + j.leads, 0) : depenses.filter((d) => inM(dayMs(d.du))).reduce((x, d) => x + (d.leadsMeta ?? 0), 0),
        leadsCrm: (allLeads ?? []).filter((l) => (l.board || "leads") === "leads" && canalOf(l) && inM(Date.parse(l.createdAt))).length,
        signes: sg.length,
        marge: sg.reduce((x, l) => x + (margeOf(l).marge ?? 0), 0),
      });
    }
    return out.reverse();
  }, [allLeads, depenses, jours, from, to, colsVersion]);

  // Semaine par semaine (export Meta) : dépensé, leads comptés par Meta, coût par lead, leads arrivés dans le CRM.
  const semaines = useMemo(() => {
    const lundi = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
    const m = new Map<number, { dep: number; leads: number; imp: number; crm: number; signes: number }>();
    const get = (k: number) => m.get(k) ?? (m.set(k, { dep: 0, leads: 0, imp: 0, crm: 0, signes: 0 }), m.get(k)!);
    for (const j of jours) if (j.canal !== "autre") { const e = get(lundi(dayMs(j.jour))); e.dep += j.depense; e.leads += j.leads; e.imp += j.impressions; }
    if (!m.size) return [];
    const debut = Math.min(...Array.from(m.keys()));
    for (const l of allLeads ?? []) {
      if ((l.board || "leads") !== "leads" || !canalOf(l)) continue;
      const t = Date.parse(l.createdAt);
      if (t < debut) continue;
      const e = get(lundi(t)); e.crm++; if (isSigne(l)) e.signes++;
    }
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]).slice(0, 12).map(([k, e]) => ({ k, ...e, cpl: e.leads ? e.dep / e.leads : null }));
  }, [jours, allLeads, colsVersion]);
  // Alerte : coût par lead de la dernière semaine complète comparé aux 4 semaines d'avant.
  const alerte = (() => {
    const pleines = semaines.filter((w) => w.k + 7 * DAY <= Date.now() && w.dep > 0);
    const [der, ...avant] = pleines;
    const ref = avant.slice(0, 4);
    if (!der || ref.length < 2) return null;
    const refCpl = ref.reduce((x, w) => x + w.dep, 0) / Math.max(1, ref.reduce((x, w) => x + w.leads, 0));
    const cpl = der.leads ? der.dep / der.leads : Infinity;
    return cpl >= refCpl * 1.5 ? { cpl, refCpl, der } : null;
  })();
  const parCampagne = useMemo(() => {
    const m = new Map<string, { dep: number; leads: number; imp: number; dernier: string; budget: number }>();
    for (const j of jours) {
      if (dayMs(j.jour) < from || dayMs(j.jour) >= to) continue;
      const e = m.get(j.campagne) ?? { dep: 0, leads: 0, imp: 0, dernier: "", budget: 0 };
      e.dep += j.depense; e.leads += j.leads; e.imp += j.impressions;
      if (j.jour > e.dernier) { e.dernier = j.jour; e.budget = j.budget; }
      m.set(j.campagne, e);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].dep - a[1].dep);
  }, [jours, from, to]);
  const couleurCpl = (c: number | null) => (c === null ? "text-red-600" : c <= 22 ? "text-emerald-700" : c <= 35 ? "text-amber-600" : "text-red-600");
  const jourFr = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  const [voirDepenses, setVoirDepenses] = useState(false);
  const champ = "rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 [color-scheme:light] px-2 py-1.5 text-sm";
  const carte = "rounded-2xl border border-gray-200 bg-white p-4 md:p-5";
  const titre = (t: string, sous?: string) => (
    <div className="mb-3">
      <h2 className="text-base font-black text-gray-900">{t}</h2>
      {sous && <p className="text-xs text-gray-500">{sous}</p>}
    </div>
  );

  // Une ligne = un client : ce qu'on touche tout de suite (CEE − pose), plus tard (MaPrimeRénov' − frais), le total,
  // et si on peut poser (la CEE couvre la pose, ou la MaPrimeRénov' est reçue).
  // Mois de signature, lu dans l'étiquette (« Signé en novembre » → novembre).
  const ligneSigne = (l: Lead) => {
    const m = margeOf(l);
    const compte = vientDeMeta(l);
    const vite = ceeSeule(l);
    const mpr = mprOf(l);
    const tard = mpr === null ? null : mpr - fraisOf(l);
    const peutPoser = (vite ?? 0) >= 0 || mprRecue(l);
    const fort = compte ? "text-gray-900" : "text-gray-500";
    return (
      <tr key={l.id} className="border-b border-gray-100 align-middle">
        <td className="py-3 px-2">
          <p className={`font-bold ${fort}`}>{l.name}</p>
          <p className="text-xs text-gray-500">{origine(l)}</p>
          <button onClick={() => basculerMeta(l, !compte)} className="text-[11px] text-gray-400 underline hover:text-gray-700">
            {compte ? "ne pas compter ce client" : "➕ il vient de la pub, le compter"}
          </button>
        </td>
        <td className="px-2 whitespace-nowrap">
          <span className="inline-block rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-bold text-gray-800 capitalize">{moisSigne(l)}</span>
        </td>
        <td className={`px-2 text-right text-base font-bold whitespace-nowrap ${vite !== null && vite < 0 ? "text-red-600" : "text-blue-700"}`}>{eur(vite)}</td>
        <td className="px-2 text-right text-base font-bold whitespace-nowrap text-gray-700">{eur(tard)}</td>
        <td className={`px-2 text-right text-lg font-black whitespace-nowrap ${compte ? "text-emerald-700" : "text-gray-500"}`}>
          {m.marge === null ? <span className="text-sm text-amber-600">à compléter</span> : eur(m.marge)}
          {m.calc && m.marge !== null && vite !== null && tard !== null && Math.round(vite + tard) < m.marge && <span className="block text-[10px] font-semibold text-gray-400">minimum 2 500 €</span>}
          {!m.calc && <span className="block text-[10px] font-semibold text-gray-400">saisi à la main</span>}
        </td>
        <td className="px-2 text-center">
          {(vite ?? 0) >= 0 ? (
            <span className="inline-block rounded-lg bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-bold">✅ On peut poser</span>
          ) : (
            <button onClick={() => basculerMpr(l, !mprRecue(l))} className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${peutPoser ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"}`}>
              {peutPoser ? "✅ MPR reçue · on peut poser" : "⏳ Attend la MPR · cliquer si reçue"}
            </button>
          )}
        </td>
      </tr>
    );
  };
  const sousTitre = (t: string) => <span className="block mt-0.5 text-[11px] font-medium normal-case text-gray-500">{t}</span>;
  const enTete = (
    <thead className="bg-gray-50 text-[13px] font-bold text-gray-800 border-b-2 border-gray-200">
      <tr>
        <th className="text-left py-3 px-3">Client</th>
        <th className="text-left px-3">Signé en</th>
        <th className="text-right px-3">💶 Encaissé vite (CEE){sousTitre("CEE moins la pose · 1 semaine après l'installation")}</th>
        <th className="text-right px-3">⏳ Encaissé plus tard (MPR){sousTitre("MaPrimeRénov' moins les frais Praimy")}</th>
        <th className="text-right px-3">💰 Total pour IP5{sousTitre("ce qu'on gagne sur le client")}</th>
        <th className="text-center px-3">🔧 Peut-on poser ?</th>
      </tr>
    </thead>
  );

  return (
    <div className="w-full space-y-4 pb-10">
      {/* Période */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 shadow-md" style={{ background: "linear-gradient(120deg,#173a5e,#2b5a8f)" }}>
        <span className="text-base font-black text-white mr-2">Période</span>
        {PERIODES.map(([label, f]) => {
          const [a, b] = f();
          return (
            <button key={label} onClick={() => setPeriode([a, b])} className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${a === du && b === au ? "bg-white text-[#173a5e] border-white shadow" : "bg-white/10 text-white border-white/25 hover:bg-white/20"}`}>
              {label}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-2 text-sm font-semibold text-white/80">
          du <input type="date" value={du} onChange={(e) => e.target.value && setPeriode([e.target.value, au])} className={champ} />
          au <input type="date" value={au} onChange={(e) => e.target.value && setPeriode([du, e.target.value])} className={champ} />
        </span>
      </div>

      {/* Les chiffres qui comptent : l'argent, puis l'efficacité de la pub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#e6eaf2] bg-white px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Pub dépensée</p>
          <p className="text-3xl font-black text-gray-900 mt-0.5">{eur(tot.depense)}</p>
        </div>
        <div className="rounded-2xl border border-[#e6eaf2] bg-white px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">On touche sur ces clients</p>
          <p className="text-3xl font-black text-[#1f4b7f] mt-0.5">{eur(tot.marge)}</p>
          <p className="text-xs text-gray-500">dont {eur(tot.ceeSeule)} vite (CEE), le reste avec MaPrimeRénov'</p>
        </div>
        <div className={`rounded-2xl px-5 py-4 text-white shadow-md ${benef >= 0 ? "bg-gradient-to-br from-emerald-600 to-emerald-700" : "bg-gradient-to-br from-red-600 to-red-700"}`}>
          <p className="text-sm font-semibold text-white/90">Bénéfice net après pub</p>
          <p className="text-4xl font-black mt-0.5">{eur(benef)}</p>
          <p className="text-xs text-white/85">
            {tot.depense > 0 ? `1 € de pub rapporte ${(tot.marge / tot.depense).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} €` : "aucune pub enregistrée sur la période"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Leads Meta" value={String(tot.leads)} />
        <Kpi label="Coût par lead" value={tot.leads ? eur(tot.depense / tot.leads) : "—"} />
        <Kpi label="Clients signés" value={String(tot.signes)} tone={tot.signes ? "good" : undefined} />
        <Kpi label="Taux de signature" value={tot.leads ? `${((tot.signes / tot.leads) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—"} hint="clients signés / leads" />
        <Kpi label="Coût par client signé" value={tot.signes ? eur(tot.depense / tot.signes) : "—"} hint="pub dépensée / clients signés" />
      </div>
      {tot.aCompleter > 0 && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          ⚠️ {tot.aCompleter} signé{tot.aCompleter > 1 ? "s" : ""} sans montant : pas compté{tot.aCompleter > 1 ? "s" : ""}. Remplis « 🔗 Réf Praimy » ou « 💵 Marge nette » sur la fiche.
        </p>
      )}

      {/* Export Meta : semaine par semaine, alerte, campagnes, import */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <div className="mr-auto">
            <h2 className="text-lg font-black text-gray-900">Ce que dit Meta, semaine par semaine</h2>
            <p className="text-sm text-gray-600">
              {dernierJour ? `Export Meta importé jusqu'au ${jourFr(dernierJour)}` : "Aucun export Meta importé pour l'instant"} · Renvoyez l'export depuis le début : tout est remplacé, rien n'est compté deux fois.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-md hover:brightness-110" style={{ background: "linear-gradient(120deg,#173a5e,#2b5a8f)" }}>
            📥 Importer l'export Meta
            <input type="file" accept=".xls,.xml,.csv,text/csv,application/vnd.ms-excel" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importer(f); e.target.value = ""; }} />
          </label>
        </div>
        {importMsg && <p className="mb-3 rounded-lg bg-[#edf2f8] px-3 py-2 text-sm font-semibold text-[#1f4b7f]">{importMsg}</p>}
        {alerte && (
          <div className="mb-3 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <b>🚨 Le coût par lead a explosé :</b> {alerte.cpl === Infinity ? "aucun lead" : eur(alerte.cpl)} la semaine du {new Date(alerte.der.k).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}, contre {eur(alerte.refCpl)} les semaines d'avant.
            <span className="block mt-0.5 text-red-700">Pistes : changer les pubs (les mêmes depuis longtemps fatiguent), baisser le budget de la campagne en cause, relancer le formulaire Facebook.</span>
          </div>
        )}
        {semaines.length > 0 && (
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${lignesCol}`}>
              <thead className="bg-gray-50 text-[12px] font-bold text-gray-700">
                <tr>
                  <th className="text-left py-2 px-3">Semaine du</th>
                  <th className="text-right px-3">Dépensé</th>
                  <th className="text-right px-3">Leads selon Meta</th>
                  <th className="text-right px-3">Coût par lead</th>
                  <th className="text-right px-3">Leads arrivés dans le CRM</th>
                  <th className="text-right px-3">Signés</th>
                  <th className="text-right px-3">Affichages de la pub</th>
                </tr>
              </thead>
              <tbody>
                {semaines.map((w) => (
                  <tr key={w.k} className="border-t border-gray-100">
                    <td className="py-1.5 px-3 font-semibold text-gray-800">{new Date(w.k).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}{w.k + 7 * DAY > Date.now() ? " (en cours)" : ""}</td>
                    <td className="text-right px-3">{eur(w.dep)}</td>
                    <td className="text-right px-3">{w.leads}</td>
                    <td className={`text-right px-3 font-black ${couleurCpl(w.cpl)}`}>{w.cpl === null ? "aucun" : eur(w.cpl)}</td>
                    <td className="text-right px-3">{w.crm}</td>
                    <td className={`text-right px-3 ${w.signes ? "font-bold text-emerald-700" : "text-gray-400"}`}>{w.signes || "—"}</td>
                    <td className="text-right px-3 text-gray-500">{Math.round(w.imp).toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1.5 text-xs text-gray-500">Coût par lead : vert jusqu'à 22 €, orange jusqu'à 35 €, rouge au-delà.</p>
          </div>
        )}
        {parCampagne.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-1 text-sm font-black text-gray-900">Par campagne, sur la période choisie</p>
            <table className={`w-full text-sm ${lignesCol}`}>
              <thead className="bg-gray-50 text-[12px] font-bold text-gray-700">
                <tr>
                  <th className="text-left py-2 px-3">Campagne</th>
                  <th className="text-right px-3">Dépensé</th>
                  <th className="text-right px-3">Leads selon Meta</th>
                  <th className="text-right px-3">Coût par lead</th>
                  <th className="text-right px-3">Budget / jour</th>
                  <th className="text-right px-3">Dernier jour actif</th>
                </tr>
              </thead>
              <tbody>
                {parCampagne.map(([c, e]) => (
                  <tr key={c} className="border-t border-gray-100">
                    <td className="py-1.5 px-3 font-semibold text-gray-800">{c}</td>
                    <td className="text-right px-3">{eur(e.dep)}</td>
                    <td className="text-right px-3">{e.leads}</td>
                    <td className={`text-right px-3 font-black ${couleurCpl(e.leads ? e.dep / e.leads : null)}`}>{e.leads ? eur(e.dep / e.leads) : "aucun"}</td>
                    <td className="text-right px-3 text-gray-600">{e.budget ? eur(e.budget) : "—"}</td>
                    <td className="text-right px-3 text-gray-600">{e.dernier ? jourFr(e.dernier) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
        <h2 className="text-lg font-black text-gray-900">Quelle pub marche ?</h2>
        <p className="text-sm text-gray-600 mb-3">Les demandes du site sur la période, rangées par annonce Meta : combien de leads, combien avancent, combien signent.</p>
        {parPub.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune demande du site sur cette période.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-2 px-2">Annonce</th>
                  <th className="px-2 text-right">Leads</th>
                  <th className="px-2 text-right">Avancent</th>
                  <th className="px-2 text-right">Signés</th>
                  <th className="px-2 text-right">Taux</th>
                </tr>
              </thead>
              <tbody>
                {parPub.map(([annonce, e]) => (
                  <tr key={annonce || "-"} className="border-t border-gray-100">
                    <td className="py-2 px-2">
                      {annonce ? (
                        <>
                          <span className="font-bold text-gray-900">{annonce}</span>
                          {e.campagne && <span className="block text-[11px] text-gray-500">{e.campagne}</span>}
                        </>
                      ) : (
                        <span className="text-gray-500 italic">Pub non notée (avant le suivi, ou lien sans paramètres)</span>
                      )}
                    </td>
                    <td className="px-2 text-right font-semibold">{e.leads}</td>
                    <td className="px-2 text-right text-[#d97706] font-semibold">{e.avancent}</td>
                    <td className="px-2 text-right text-[#059669] font-black">{e.signes}</td>
                    <td className="px-2 text-right text-gray-600">{e.leads ? Math.round(((e.signes + e.avancent) / e.leads) * 100) : 0} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-gray-500">
          À mettre une fois dans Meta (Gestionnaire de publicités → chaque pub → Paramètres d'URL) :{" "}
          <code className="break-all bg-gray-100 rounded px-1">utm_source=facebook&utm_medium=paid&utm_campaign={"{{campaign.name}}"}&utm_content={"{{ad.name}}"}&utm_term={"{{adset.name}}"}</code>
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Gauche : 1) clients venus de la pub (comptés), 2) les autres signés (pas comptés) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border-2 border-emerald-300 bg-white p-4 md:p-5">
            <h2 className="text-lg font-black text-emerald-800">Clients venus des pubs Meta</h2>
            <p className="text-sm text-gray-600 mb-3">Ces clients sont arrivés grâce à la pub : <b>ils comptent dans le bénéfice</b>.</p>
            {signesMeta.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun client venu de la pub sur cette période.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className={`w-full text-sm ${lignesCol}`}>
                  {enTete}
                  <tbody>
                    {signesMeta.map(ligneSigne)}
                    <tr className="font-black bg-emerald-50">
                      <td className="py-3 px-2" colSpan={2}>Total · {signesMeta.length} client{signesMeta.length > 1 ? "s" : ""}</td>
                      <td className="px-2 text-right text-blue-700 whitespace-nowrap">{eur(signesMeta.reduce((x, l) => x + (ceeSeule(l) ?? 0), 0))}</td>
                      <td className="px-2 text-right text-gray-700 whitespace-nowrap">{eur(signesMeta.reduce((x, l) => x + ((mprOf(l) ?? 0) - fraisOf(l)), 0))}</td>
                      <td className="px-2 text-right text-lg text-emerald-700 whitespace-nowrap">{eur(tot.marge)}</td>
                      <td className="px-2 text-center text-xs font-semibold text-gray-600">{signesMeta.length - tot.attenteMpr} à poser · {tot.attenteMpr} attend{tot.attenteMpr > 1 ? "ent" : ""} la MPR</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 p-4 md:p-5">
            <h2 className="text-lg font-black text-gray-700">👥 Autres clients signés</h2>
            <p className="text-sm text-gray-600 mb-3">
              Pas venus de la pub (anciens clients LED, bouche-à-oreille, ancien fichier…) : <b>ils ne comptent pas</b> dans le bénéfice.
              Si l'un d'eux vient en fait de la pub, clique sur « ➕ Vient de la pub ».
            </p>
            {autresSignes.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className={`w-full text-sm ${lignesCol}`}>
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
            <table className={`w-full text-sm ${lignesCol}`}>
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
            <table className={`w-full text-sm ${lignesCol}`}>
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
      <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
        <h2 className="text-base font-black text-gray-900">Où les visiteurs quittent le formulaire du site</h2>
        <p className="text-sm text-gray-600 mb-3">Nombre de visiteurs qui voient chaque étape du simulateur du site (compteur anonyme, une fois par visite).</p>
        {!vus.arrivee ? (
          <p className="text-sm text-gray-500">Pas encore de chiffres sur cette période (le compteur démarre avec cette mise à jour).</p>
        ) : (
          <div className="space-y-1.5">
            {ETAPES_FORM.map(([k, label], i) => {
              const n = vus[k] ?? 0;
              const pct = Math.round((n / vus.arrivee) * 100);
              const avant = i > 0 ? vus[ETAPES_FORM[i - 1][0]] ?? 0 : n;
              const perte = avant > 0 && i > 0 ? Math.round(((avant - n) / avant) * 100) : 0;
              return (
                <div key={k} className="flex items-center gap-2 text-sm">
                  <span className="w-44 shrink-0 truncate text-gray-700">{label}</span>
                  <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: "linear-gradient(90deg,#173a5e,#2b5a8f)" }} />
                  </span>
                  <span className="w-12 text-right font-bold text-gray-900">{n}</span>
                  <span className={`w-14 text-right text-xs font-semibold ${perte >= 25 ? "text-[#dc2626]" : perte >= 10 ? "text-[#d97706]" : "text-gray-400"}`}>{i > 0 ? `−${perte} %` : ""}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
