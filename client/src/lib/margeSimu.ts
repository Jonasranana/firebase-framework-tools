import { useEffect, useRef, useState } from "react";
import { crmFirestore } from "@/lib/crmDb";

// ─────────────────────────────────────────────────────────────────────────
// Simulateur de marge d'une pompe à chaleur air/eau vendue et posée par nous
// (règles CEE BAR-TH-171 + Coup de pouce et MaPrimeRénov' en vigueur depuis le
// 16 novembre 2026). Utilisé par la page « Marges PRAIMY » et par « Tournées
// Loan » (marge de chaque dossier). Réglages partagés par toute l'équipe :
// Firestore crm_boards/simulateur_marge.
//
// Calcul (par zone et par profil) :
//   volume CEE  = forfait (Etas) × facteur surface × facteur zone × bonification Coup de pouce
//   CEE total   = volume (MWh cumac) × valorisation (€/MWh)
//   CEE affiché = min(CEE total, prix × (1 − reste à charge visé) − MPR)   ← prime annoncée au client
//   surplus     = CEE total − CEE affiché (gardé, c'est de la marge)
//   reste à charge client = prix − MPR − CEE affiché
//   encaissé HT = (CEE total + MPR + reste à charge) / (1 + TVA 5,5 %)
//   marge       = encaissé HT − matériel − pose
// ─────────────────────────────────────────────────────────────────────────

export type Profil = "Bleu" | "Jaune" | "Violet" | "Rose";
export type Zone = "H1" | "H2" | "H3";

export const ZONES: { z: Zone; coef: number }[] = [
  { z: "H1", coef: 1.2 },
  { z: "H2", coef: 1 },
  { z: "H3", coef: 0.7 },
];

export const PROFILS: { p: Profil; label: string; mpr: number; plafond: number; hex: string }[] = [
  { p: "Bleu", label: "Bleu · très modeste", mpr: 5000, plafond: 0.9, hex: "#2563eb" },
  { p: "Jaune", label: "Jaune · modeste", mpr: 4000, plafond: 0.75, hex: "#eab308" },
  { p: "Violet", label: "Violet · intermédiaire", mpr: 3000, plafond: 0.6, hex: "#9333ea" },
  { p: "Rose", label: "Rose · classique (sans MPR)", mpr: 0, plafond: 1, hex: "#ec4899" },
];

// Depuis le 16/11/2026, Coup de pouce ×3 pour les ménages « Jaune » (précarité non très modeste) ; ×5 pour les autres.
export const DATE_NOUVELLE_REGLE = "2026-11-16";
export const bonification = (p: Profil, avantNouvelleRegle = false) => (p === "Jaune" && !avantNouvelleRegle ? 3 : 5);

export type SimuParams = {
  prix: number; // prix de vente TTC
  surface: number; // m² chauffés
  etas: number; // forfait kWh cumac : 109 200 (Etas ≥ 140 %) ou 90 900
  valoBleu: number; // €/MWh cumac (grand précaire)
  valoJaune: number; // €/MWh cumac (précaire)
  valoViolet: number; // €/MWh cumac (classique)
  valoRose: number;
  materiel: number; // € HT
  pose: number; // € HT (sous-traitance, autoliquidation)
  racBleu: number; // reste à charge visé, en %
  racJaune: number;
  racViolet: number;
  racRose: number;
  tva: number; // %
};

export const SIMU_DEFAUT: SimuParams = {
  prix: 12000,
  surface: 100,
  etas: 109200,
  valoBleu: 13,
  valoJaune: 13,
  valoViolet: 7,
  valoRose: 7,
  materiel: 3200,
  pose: 2700,
  racBleu: 10,
  racJaune: 25,
  racViolet: 40,
  racRose: 60,
  tva: 5.5,
};

export const facteurSurface = (s: number) => (s < 70 ? 0.5 : s < 90 ? 0.7 : 1);
const valo = (sp: SimuParams, p: Profil) => (p === "Bleu" ? sp.valoBleu : p === "Jaune" ? sp.valoJaune : p === "Violet" ? sp.valoViolet : sp.valoRose);
const racVise = (sp: SimuParams, p: Profil) => (p === "Bleu" ? sp.racBleu : p === "Jaune" ? sp.racJaune : p === "Violet" ? sp.racViolet : sp.racRose) / 100;

export type ResultatMarge = {
  ceeTotal: number;
  ceeAffiche: number;
  surplus: number;
  mpr: number;
  rac: number;
  racPct: number;
  encaisseHT: number;
  marge: number;
  margePct: number;
  depassePlafond: boolean; // MPR + CEE affiché au-delà du plafond d'aides (écrêtement Anah)
};

export function calculMarge(
  sp: SimuParams,
  zone: Zone,
  p: Profil,
  o: { prix?: number; surface?: number; avantNouvelleRegle?: boolean; sansPose?: boolean } = {},
): ResultatMarge {
  const prix = o.prix ?? sp.prix;
  const surface = o.surface ?? sp.surface;
  const zc = ZONES.find((x) => x.z === zone)?.coef ?? 1;
  const prof = PROFILS.find((x) => x.p === p)!;
  const volume = sp.etas * facteurSurface(surface) * zc * bonification(p, o.avantNouvelleRegle);
  const ceeTotal = (volume / 1000) * valo(sp, p);
  const ceeAffiche = Math.min(ceeTotal, Math.max(0, prix * (1 - racVise(sp, p)) - prof.mpr));
  const surplus = ceeTotal - ceeAffiche;
  const rac = prix - prof.mpr - ceeAffiche;
  const encaisseHT = (ceeTotal + prof.mpr + rac) / (1 + sp.tva / 100);
  const marge = encaisseHT - sp.materiel - (o.sansPose ? 0 : sp.pose);
  const depense = Math.min(prix, 12000);
  return {
    ceeTotal,
    ceeAffiche,
    surplus,
    mpr: prof.mpr,
    rac,
    racPct: prix > 0 ? rac / prix : 0,
    encaisseHT,
    marge,
    margePct: encaisseHT > 0 ? marge / encaisseHT : 0,
    depassePlafond: prof.mpr > 0 && prof.mpr + ceeAffiche > prof.plafond * depense + 0.5,
  };
}

// ── Zone climatique d'après le département (découpage H1 / H2 / H3 des fiches CEE) ──
const H1 = "01 02 03 05 08 10 14 15 19 21 23 25 27 38 39 42 43 45 51 52 54 55 57 58 59 60 61 62 63 67 68 69 70 71 73 74 75 76 77 78 80 87 88 89 90 91 92 93 94 95".split(" ");
const H3 = "06 11 13 2A 2B 20 30 34 66 83".split(" ");
export function zoneDuCp(cp: string): Zone {
  const d = String(cp ?? "").trim().padStart(5, "0").slice(0, 2);
  if (H3.includes(d)) return "H3";
  if (H1.includes(d)) return "H1";
  return "H2";
}

// Catégorie du fichier / du CRM → profil (couleur).
export function profilDe(cat: string): Profil | null {
  const c = String(cat ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/tres modeste|bleu/.test(c)) return "Bleu";
  if (/modeste|jaune/.test(c)) return "Jaune";
  if (/interm|violet/.test(c)) return "Violet";
  if (/classique|rose/.test(c)) return "Rose";
  return null;
}

// ── Réglages partagés (Firestore) ──────────────────────────────────────────
export function useSimuParams(email: string) {
  const [params, setParams] = useState<SimuParams>(SIMU_DEFAUT);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.doc(db, "crm_boards", "simulateur_marge"),
          (snap: any) => {
            if (cancelled) return;
            const d = snap.data();
            if (d?.params) setParams({ ...SIMU_DEFAUT, ...d.params });
            setLoaded(true);
          },
          () => !cancelled && setLoaded(true),
        );
      } catch {
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);
  const save = (next: SimuParams) => {
    setParams(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const { m, db } = await crmFirestore();
        await m.setDoc(m.doc(db, "crm_boards", "simulateur_marge"), { params: next, updatedAt: m.serverTimestamp(), updatedBy: email }, { merge: true });
        setError("");
      } catch (e) {
        console.error(e);
        setError("Impossible d'enregistrer les réglages.");
      }
    }, 600);
  };
  return { params, save, loaded, error };
}
