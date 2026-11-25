// ─────────────────────────────────────────────────────────────────────────
// « Tournées Loan » : simulation des tournées d'installation de l'équipe de
// Loan (2 installateurs, départ d'Aix-en-Provence par défaut). À partir des dossiers à poser,
// on construit semaine par semaine l'ordre des chantiers, les trajets, les
// nuits (hôtel ou Airbnb) et le coût complet, comparé à la marge de chaque
// dossier. Tout est recalculé dans le navigateur quand un réglage change.
// Distances : à vol d'oiseau × coefficient routier (pas d'appel à un service
// d'itinéraire) ; c'est une estimation, suffisante pour organiser et chiffrer.
// ─────────────────────────────────────────────────────────────────────────

export type DossierLoan = {
  ref: string;
  client: string;
  ville: string;
  cp: string;
  statut: string; // Signé, Audit, Devis, Installé…
  categorie: string; // Très modeste, Modeste, Intermédiaire, Classique
  marge: number | null; // marge du dossier (€) hors frais d'installation Loan
  kw: number | null;
  inclus: boolean; // pris dans le plan
  fait?: boolean; // déjà posé par Loan
  jours?: number | null; // durée de pose forcée (sinon selon la puissance)
  nouvelleFiche?: boolean; // signé avec la nouvelle fiche CEE : on ajoute le gain réglé dans les paramètres
  margeModifiee?: boolean; // marge corrigée à la main : gardée lors d'un nouvel import
  note?: string;
};

export type ParamsLoan = {
  debut: string; // AAAA-MM-JJ (un lundi de préférence)
  depart: string; // ville de départ (affichage)
  departLat: number;
  departLng: number;
  personnes: number;
  coutJourPose: number; // € par jour de pose pour toute l'équipe
  coutJourRoute: number; // € par jour passé uniquement sur la route
  primeParPose: number; // € en plus par installation (si Loan est payé à la pose)
  consoL100: number;
  prixCarburant: number; // €/L
  peageKm: number; // €/km en moyenne (part d'autoroute comprise)
  hotelNuit: number; // € la nuit pour l'équipe
  airbnbNuit: number; // € la nuit pour l'équipe (logement entier)
  airbnbDesNuits: number; // Airbnb dès N nuits au même endroit
  repasHotel: number; // € par personne et par jour (restaurant / sandwich)
  repasAirbnb: number; // € par personne et par jour (courses + cuisine)
  seuilKw2Jours: number; // au-delà de cette puissance, la pose prend 2 jours
  retourWeekend: boolean; // rentrer au point de départ chaque week-end
  rayonMax: number; // km (route estimée) au-delà desquels on ne va pas…
  groupeMin: number; // …sauf s'il y a au moins ce nombre de poses…
  groupeRayon: number; // …à moins de ce nombre de km les unes des autres
  rayonLoin: number; // au-delà de cette distance (très loin)…
  groupeMinLoin: number; // …il faut au moins ce nombre de poses groupées
  coefRoute: number; // distance route / vol d'oiseau
  vitesse: number; // km/h moyenne porte à porte
  routeSoirMax: number; // heures de route possibles le soir après un chantier
  routeMatinMax: number; // heures de route le matin avant de commencer
  routeJourMax: number; // heures de route sur une journée sans chantier
  gainNouvelleFiche: number; // € de marge en plus par dossier signé avec la nouvelle fiche
};

export const PARAMS_DEFAUT: ParamsLoan = {
  debut: "2026-12-07",
  depart: "Aix-en-Provence",
  departLat: 43.5297,
  departLng: 5.4474,
  personnes: 2,
  coutJourPose: 400,
  coutJourRoute: 300,
  primeParPose: 0,
  consoL100: 10,
  prixCarburant: 1.75,
  peageKm: 0.07,
  hotelNuit: 70,
  airbnbNuit: 85,
  airbnbDesNuits: 4,
  repasHotel: 18,
  repasAirbnb: 10,
  seuilKw2Jours: 14,
  retourWeekend: true,
  rayonMax: 500,
  groupeMin: 2,
  groupeRayon: 100,
  rayonLoin: 700,
  groupeMinLoin: 3,
  coefRoute: 1.2,
  vitesse: 90,
  routeSoirMax: 3,
  routeMatinMax: 1,
  routeJourMax: 12,
  gainNouvelleFiche: 0,
};

// ── Géographie ────────────────────────────────────────────────────────────
export type Geo = { cp: Record<string, [string, number, number][]>; dep: Record<string, [number, number]> };
let geoPromise: Promise<Geo> | null = null;
export function loadGeo(): Promise<Geo> {
  if (!geoPromise)
    geoPromise = fetch("/data/communes-geo.json")
      .then((r) => r.json())
      .catch((e) => {
        geoPromise = null;
        throw e;
      });
  return geoPromise;
}
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const cleVille = (s: string) =>
  sansAccents(String(s ?? ""))
    .toLowerCase()
    .replace(/^(le|la|les|l)['\s-]+/, "")
    .replace(/saint/g, "st")
    .replace(/[^a-z0-9]/g, "");

export type Point = { lat: number; lng: number; approx: boolean };
export function localiser(geo: Geo, cp: string, ville: string): Point | null {
  const code = String(cp ?? "").trim().padStart(5, "0");
  const list = geo.cp[code] ?? [];
  const k = cleVille(ville);
  const hit = list.find((e) => e[0] === k) ?? list.find((e) => k && (e[0].includes(k) || k.includes(e[0])));
  if (hit) return { lat: hit[1], lng: hit[2], approx: false };
  if (list.length) return { lat: list[0][1], lng: list[0][2], approx: true };
  const d = geo.dep[code.slice(0, 2)];
  return d ? { lat: d[0], lng: d[1], approx: true } : null;
}

const R = 6371;
export function volOiseau(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const t = Math.PI / 180;
  const dLat = (b.lat - a.lat) * t;
  const dLng = (b.lng - a.lng) * t;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ── Calendrier ────────────────────────────────────────────────────────────
const FERIES = new Set([
  "2026-12-25", "2027-01-01", "2027-03-29", "2027-05-01", "2027-05-06", "2027-05-08", "2027-05-17", "2027-07-14", "2027-08-15", "2027-11-01", "2027-11-11", "2027-12-25",
  "2028-01-01", "2028-04-17", "2028-05-01", "2028-05-08", "2028-05-25", "2028-06-05", "2028-07-14", "2028-08-15", "2028-11-01", "2028-11-11", "2028-12-25",
]);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const ouvre = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5 && !FERIES.has(iso(d));
const prochainOuvre = (d: Date) => {
  let x = new Date(d);
  while (!ouvre(x)) x = addDays(x, 1);
  return x;
};
// Le premier jour ouvré qui laisse n jours ouvrés d'affilée dans la même semaine.
function placerPose(d: Date, n: number) {
  let x = prochainOuvre(d);
  for (let guard = 0; guard < 30; guard++) {
    let ok = true;
    for (let i = 0; i < n; i++) {
      const y = addDays(x, i);
      if (!ouvre(y) || (i > 0 && y.getDay() === 1)) ok = false;
    }
    if (ok) return x;
    x = prochainOuvre(addDays(x, 1));
  }
  return x;
}
const lundiSuivant = (d: Date) => {
  let x = addDays(d, 1);
  while (x.getDay() !== 1) x = addDays(x, 1);
  return x;
};

// ── Simulation ────────────────────────────────────────────────────────────
export type Jour = {
  date: string;
  type: "pose" | "route" | "weekend";
  texte: string;
  ref?: string;
  km: number;
  heures: number;
  nuit?: string; // où l'équipe dort ce soir-là (vide = à la maison)
};
export type Sejour = { ville: string; lat: number; lng: number; nuits: number; type: "hotel" | "airbnb"; cout: number; debut: string };
export type Tournee = {
  n: number;
  debut: string;
  fin: string;
  jours: Jour[];
  sejours: Sejour[];
  refs: string[];
  km: number;
  cout: { equipe: number; route: number; logement: number; repas: number; total: number };
  marge: number;
  trace: { lat: number; lng: number }[];
};
export type LigneDossier = {
  d: DossierLoan;
  pt: Point | null;
  jours: number;
  kmDepart: number;
  tournee?: number;
  date?: string;
  cout: number;
  marge: number;
  net: number;
  tropLoin?: boolean; // au-delà du rayon et pas assez de poses dans le coin
};
export type Resultat = {
  tournees: Tournee[];
  lignes: LigneDossier[];
  nonPlaces: LigneDossier[];
  total: { poses: number; joursPose: number; joursRoute: number; km: number; equipe: number; route: number; logement: number; repas: number; cout: number; marge: number; net: number; nuitsHotel: number; nuitsAirbnb: number; fin: string };
};
export type ModeLogement = "auto" | "hotel" | "airbnb";

export function joursPose(d: DossierLoan, p: ParamsLoan) {
  if (d.jours && d.jours > 0) return d.jours;
  return (d.kw ?? 0) > p.seuilKw2Jours ? 2 : 1;
}
export const margeDossier = (d: DossierLoan, p: ParamsLoan) => (d.marge ?? 0) + (d.nouvelleFiche ? p.gainNouvelleFiche : 0);

type Job = { d: DossierLoan; pt: Point; jours: number };

export function simuler(dossiers: DossierLoan[], geo: Geo, p: ParamsLoan, logement: ModeLogement = "auto"): Resultat {
  const base = { lat: p.departLat, lng: p.departLng };
  const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => volOiseau(a, b) * p.coefRoute;
  const h = (k: number) => (k < 1 ? 0 : k / p.vitesse + 0.25);
  const lignes: LigneDossier[] = dossiers.map((d) => {
    const pt = localiser(geo, d.cp, d.ville);
    return { d, pt, jours: joursPose(d, p), kmDepart: pt ? Math.round(km(base, pt)) : 0, cout: 0, marge: margeDossier(d, p), net: 0 };
  });
  const parRef = new Map(lignes.map((l) => [l.d.ref, l]));
  // Règle de distance : au-delà de rayonMax km du départ, on n'y va que s'il y a au moins
  // groupeMin poses (celle-ci comprise) à moins de groupeRayon km les unes des autres ;
  // au-delà de rayonLoin km, il en faut groupeMinLoin.
  const candidats = lignes.filter((l) => l.d.inclus && !l.d.fait && l.pt);
  if (p.rayonMax > 0)
    for (const l of candidats) {
      if (l.kmDepart <= p.rayonMax) continue;
      const voisins = candidats.filter((o) => km(l.pt!, o.pt!) <= p.groupeRayon).length;
      const mini = p.rayonLoin > 0 && l.kmDepart > p.rayonLoin ? p.groupeMinLoin : p.groupeMin;
      if (voisins < Math.max(1, mini)) l.tropLoin = true;
    }
  let restants: Job[] = candidats.filter((l) => !l.tropLoin).map((l) => ({ d: l.d, pt: l.pt!, jours: l.jours }));

  const tournees: Tournee[] = [];
  let cur = new Date(`${p.debut}T12:00:00`);
  if (isNaN(cur.getTime())) cur = new Date();
  cur = prochainOuvre(cur);

  // Choix du premier chantier d'une tournée : le coin où il y a le plus de travail groupé,
  // à égalité le plus loin (les longs trajets se font quand il y a de quoi remplir la semaine).
  const graine = () => {
    let best: Job | null = null;
    let bestScore = -1;
    for (const a of restants) {
      let s = 0;
      for (const b of restants) s += Math.max(0, 1 - h(km(a.pt, b.pt)) / 3.5) * b.jours;
      s += km(base, a.pt) / 5000;
      if (s > bestScore) (bestScore = s), (best = a);
    }
    return best!;
  };

  let guard = 0;
  while (restants.length && guard++ < 200) {
    const t: Tournee = { n: tournees.length + 1, debut: iso(cur), fin: iso(cur), jours: [], sejours: [], refs: [], km: 0, cout: { equipe: 0, route: 0, logement: 0, repas: 0, total: 0 }, marge: 0, trace: [base] };
    let pos: { lat: number; lng: number; ville: string } = { ...base, ville: p.depart };
    let aLaMaison = true;
    let jour = new Date(cur); // prochain jour disponible
    let soirLibre = false; // la veille était un jour de chantier : on peut rouler le soir
    const nuit = (ville: string) => {
      const last = t.jours[t.jours.length - 1];
      if (last) last.nuit = ville;
    };
    const route = (de: string, vers: { lat: number; lng: number; ville: string }, k: number, dateRoute: Date) => {
      t.jours.push({ date: iso(dateRoute), type: "route", texte: `Route ${de} → ${vers.ville}`, km: Math.round(k), heures: h(k), nuit: vers.ville });
      t.km += k;
    };

    for (;;) {
      if (!restants.length) break;
      // Prochain chantier : la graine si on part du dépôt, sinon le plus proche.
      let next: Job;
      if (aLaMaison) next = graine();
      else {
        next = restants.reduce((a, b) => (km(pos, a.pt) <= km(pos, b.pt) ? a : b));
        if (h(km(pos, next.pt)) > 4.5) break; // trop loin : on termine la tournée
      }
      const kTrajet = km(pos, next.pt);
      const hTrajet = h(kTrajet);
      const dest = { lat: next.pt.lat, lng: next.pt.lng, ville: next.d.ville };
      // Simulation sur une copie : si ça ne rentre pas dans la semaine, on n'applique pas.
      const plan: { routes: { date: Date; k: number }[]; soir: boolean; debutPose: Date } = { routes: [], soir: false, debutPose: jour };
      let j = new Date(jour);
      if (aLaMaison) {
        if (hTrajet > p.routeMatinMax + 0.5) {
          let reste = hTrajet;
          while (reste > 0.01) {
            j = prochainOuvre(j);
            plan.routes.push({ date: j, k: (kTrajet * Math.min(reste, p.routeJourMax)) / hTrajet });
            reste -= p.routeJourMax;
            j = addDays(j, 1);
          }
        }
      } else if (hTrajet > p.routeMatinMax) {
        let reste = hTrajet;
        if (soirLibre && hTrajet <= p.routeSoirMax) {
          plan.soir = true;
          reste = 0;
        } else if (soirLibre) {
          reste -= p.routeSoirMax;
          if (reste <= p.routeMatinMax) reste = 0; // la fin du trajet se fait le matin avant le chantier
        }
        while (reste > 0.01) {
          j = prochainOuvre(j);
          plan.routes.push({ date: j, k: (kTrajet * Math.min(reste, p.routeJourMax)) / hTrajet });
          reste -= p.routeJourMax;
          j = addDays(j, 1);
        }
      }
      const debutPose = placerPose(j, next.jours);
      const finPose = addDays(debutPose, next.jours - 1);
      // Doit tenir dans la semaine en cours (sauf premier chantier) et laisser rentrer avant dimanche.
      const limite = p.retourWeekend ? addDays(cur, 5 - cur.getDay()) : null; // vendredi de la semaine de départ
      if (t.refs.length && limite && finPose > limite) break;
      // Jours sans travail (week-end, jour férié) passés sur place avant ce chantier.
      const repos: Jour[] = [];
      if (!aLaMaison) {
        const prises = new Set(plan.routes.map((r) => iso(r.date)));
        for (let x = new Date(jour); x < debutPose; x = addDays(x, 1))
          if (!ouvre(x) && !prises.has(iso(x))) repos.push({ date: iso(x), type: "weekend", texte: "Repos sur place", km: 0, heures: 0 });
      }
      // Appliquer.
      if (plan.soir) {
        nuit(dest.ville);
        const last = t.jours[t.jours.length - 1];
        if (last) {
          last.km += Math.round(kTrajet);
          last.heures += hTrajet;
          last.texte += ` · le soir : route vers ${dest.ville} (${Math.round(kTrajet)} km)`;
        }
        t.km += kTrajet;
      } else if (plan.routes.length) {
        if (soirLibre && hTrajet > p.routeSoirMax) {
          const kSoir = (kTrajet * p.routeSoirMax) / hTrajet;
          const last = t.jours[t.jours.length - 1];
          if (last) {
            last.km += Math.round(kSoir);
            last.heures += p.routeSoirMax;
            last.texte += ` · le soir : début de route vers ${dest.ville}`;
            last.nuit = "Étape sur la route";
          }
          t.km += kSoir;
        }
        plan.routes.forEach((r, i) => route(i === 0 ? pos.ville : "étape", i === plan.routes.length - 1 ? dest : { ...dest, ville: "Étape sur la route" }, r.k, r.date));
      } else if (kTrajet >= 1) {
        // court trajet le matin
        t.km += kTrajet;
      }
      for (const r of repos) {
        const avant = [...t.jours].reverse().find((x) => x.date < r.date);
        r.nuit = avant?.nuit || dest.ville;
        r.texte = `Repos sur place (${r.nuit === "Étape sur la route" ? "en route" : r.nuit})`;
        t.jours.push(r);
      }
      t.jours.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      for (let i = 0; i < next.jours; i++) {
        const dj = addDays(debutPose, i);
        t.jours.push({
          date: iso(dj),
          type: "pose",
          texte: `Pose chez ${next.d.client} — ${next.d.ville} (${next.d.cp})${next.jours > 1 ? ` · jour ${i + 1}/${next.jours}` : ""}`,
          ref: next.d.ref,
          km: i === 0 && !plan.soir && !plan.routes.length ? Math.round(kTrajet) : 0,
          heures: i === 0 && !plan.soir && !plan.routes.length ? hTrajet : 0,
          nuit: dest.ville,
        });
      }
      t.refs.push(next.d.ref);
      t.trace.push(next.pt);
      const l = parRef.get(next.d.ref)!;
      l.tournee = t.n;
      l.date = iso(debutPose);
      restants = restants.filter((x) => x !== next);
      pos = dest;
      aLaMaison = false;
      jour = addDays(finPose, 1);
      soirLibre = true;
    }

    // Retour au point de départ.
    if (!aLaMaison) {
      const kR = km(pos, base);
      const hR = h(kR);
      const last = t.jours[t.jours.length - 1];
      if (hR <= p.routeSoirMax + 1.5 && last) {
        last.km += Math.round(kR);
        last.heures += hR;
        last.texte += ` · retour à ${p.depart} le soir (${Math.round(kR)} km)`;
        last.nuit = "";
      } else {
        let reste = hR;
        let j = addDays(new Date(`${last?.date ?? iso(jour)}T12:00:00`), 1);
        while (reste > 0.01) {
          const k = (kR * Math.min(reste, p.routeJourMax)) / hR;
          reste -= p.routeJourMax;
          t.jours.push({ date: iso(j), type: "route", texte: `Retour ${pos.ville} → ${p.depart}`, km: Math.round(k), heures: Math.min(hR, p.routeJourMax), nuit: reste > 0.01 ? "Étape sur la route" : "" });
          j = addDays(j, 1);
        }
      }
      t.km += kR;
      t.trace.push(base);
    }

    // Nuits → séjours (hôtel / Airbnb) : nuits consécutives à moins de 50 km du même endroit.
    const ptsVille = new Map<string, { lat: number; lng: number }>();
    for (const r of t.refs) {
      const l = parRef.get(r)!;
      if (l.pt) ptsVille.set(l.d.ville, l.pt);
    }
    let sej: Sejour | null = null;
    for (const jj of t.jours) {
      if (!jj.nuit) {
        sej = null;
        continue;
      }
      const pt: { lat: number; lng: number } = ptsVille.get(jj.nuit) ?? (sej ? { lat: sej.lat, lng: sej.lng } : base);
      if (sej && jj.nuit !== "Étape sur la route" && sej.ville !== "Étape sur la route" && volOiseau(sej, pt) < 50) sej.nuits++;
      else {
        sej = { ville: jj.nuit, lat: pt.lat, lng: pt.lng, nuits: 1, type: "hotel", cout: 0, debut: jj.date };
        t.sejours.push(sej);
      }
    }
    for (const s of t.sejours) {
      const airbnb = logement === "airbnb" || (logement === "auto" && s.nuits >= p.airbnbDesNuits && s.ville !== "Étape sur la route");
      s.type = airbnb ? "airbnb" : "hotel";
      s.cout = s.nuits * (airbnb ? p.airbnbNuit : p.hotelNuit);
    }

    // Coûts de la tournée.
    const joursPoseT = t.jours.filter((x) => x.type === "pose").length;
    const joursRouteT = t.jours.filter((x) => x.type === "route").length;
    t.cout.equipe = joursPoseT * p.coutJourPose + joursRouteT * p.coutJourRoute + t.refs.length * p.primeParPose;
    t.cout.route = t.km * ((p.consoL100 / 100) * p.prixCarburant + p.peageKm);
    t.cout.logement = t.sejours.reduce((s, x) => s + x.cout, 0);
    // Repas : chaque journée hors de la maison ; moins cher les jours où l'équipe loge en Airbnb.
    const airbnbDates = new Set<string>();
    for (const s of t.sejours.filter((x) => x.type === "airbnb")) for (let i = 0; i < s.nuits; i++) airbnbDates.add(iso(addDays(new Date(`${s.debut}T12:00:00`), i)));
    t.cout.repas = t.jours.reduce((s, x) => s + p.personnes * (airbnbDates.has(x.date) ? p.repasAirbnb : p.repasHotel), 0);
    t.cout.total = t.cout.equipe + t.cout.route + t.cout.logement + t.cout.repas;
    t.debut = t.jours[0]?.date ?? t.debut;
    t.fin = t.jours[t.jours.length - 1]?.date ?? t.fin;
    // Répartition du coût sur les dossiers, au prorata des jours de pose.
    const jp = t.refs.reduce((s, r) => s + parRef.get(r)!.jours, 0) || 1;
    for (const r of t.refs) {
      const l = parRef.get(r)!;
      l.cout = (t.cout.total * l.jours) / jp;
      t.marge += l.marge;
    }
    tournees.push(t);
    // Tournée suivante : le lundi d'après (retour chaque week-end) ou le lendemain.
    const finT = new Date(`${t.fin}T12:00:00`);
    cur = p.retourWeekend ? prochainOuvre(lundiSuivant(finT)) : prochainOuvre(addDays(finT, 1));
  }

  for (const l of lignes) l.net = l.marge - l.cout;
  const places = lignes.filter((l) => l.tournee);
  const nonPlaces = lignes.filter((l) => l.d.inclus && !l.d.fait && !l.tournee && !l.tropLoin);
  const sum = (f: (t: Tournee) => number) => tournees.reduce((s, t) => s + f(t), 0);
  const total = {
    poses: places.length,
    joursPose: sum((t) => t.jours.filter((x) => x.type === "pose").length),
    joursRoute: sum((t) => t.jours.filter((x) => x.type === "route").length),
    km: sum((t) => t.km),
    equipe: sum((t) => t.cout.equipe),
    route: sum((t) => t.cout.route),
    logement: sum((t) => t.cout.logement),
    repas: sum((t) => t.cout.repas),
    cout: sum((t) => t.cout.total),
    marge: places.reduce((s, l) => s + l.marge, 0),
    net: 0,
    nuitsHotel: sum((t) => t.sejours.filter((s) => s.type === "hotel").reduce((a, s) => a + s.nuits, 0)),
    nuitsAirbnb: sum((t) => t.sejours.filter((s) => s.type === "airbnb").reduce((a, s) => a + s.nuits, 0)),
    fin: tournees[tournees.length - 1]?.fin ?? "",
  };
  total.net = total.marge - total.cout;
  return { tournees, lignes, nonPlaces, total };
}

// ── Import du fichier Excel (.xlsx) sans bibliothèque ─────────────────────
// Un .xlsx est un zip de fichiers XML : on lit le zip, puis la feuille « Tous les dossiers »
// (ou la première qui a une colonne « Référence »).
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--)
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("Fichier Excel illisible");
  const n = v.getUint16(eocd + 10, true);
  let off = v.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let i = 0; i < n; i++) {
    const method = v.getUint16(off + 10, true);
    const csize = v.getUint32(off + 20, true);
    const nameLen = v.getUint16(off + 28, true);
    const extraLen = v.getUint16(off + 30, true);
    const commLen = v.getUint16(off + 32, true);
    const local = v.getUint32(off + 42, true);
    const name = dec.decode(u8.subarray(off + 46, off + 46 + nameLen));
    off += 46 + nameLen + extraLen + commLen;
    if (!/\.(xml|rels)$/.test(name)) continue;
    const lNameLen = v.getUint16(local + 26, true);
    const lExtra = v.getUint16(local + 28, true);
    const data = u8.subarray(local + 30 + lNameLen + lExtra, local + 30 + lNameLen + lExtra + csize);
    if (method === 0) out.set(name, data);
    else if (method === 8) {
      const ds = new (window as any).DecompressionStream("deflate-raw");
      const ab = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
      out.set(name, new Uint8Array(ab));
    }
  }
  return out;
}
const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};
export async function lireExcel(file: File): Promise<string[][]> {
  const files = await unzip(await file.arrayBuffer());
  const dec = new TextDecoder();
  const xml = (name: string) => {
    const f = files.get(name);
    return f ? new DOMParser().parseFromString(dec.decode(f), "application/xml") : null;
  };
  const shared: string[] = [];
  const ss = xml("xl/sharedStrings.xml");
  if (ss) for (const si of Array.from(ss.getElementsByTagName("si"))) shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
  const wb = xml("xl/workbook.xml");
  const rels = xml("xl/_rels/workbook.xml.rels");
  const relMap = new Map<string, string>();
  if (rels) for (const r of Array.from(rels.getElementsByTagName("Relationship"))) relMap.set(r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? "");
  const sheets = wb
    ? Array.from(wb.getElementsByTagName("sheet")).map((s) => {
        const rid = s.getAttribute("r:id") ?? s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? "";
        const target = (relMap.get(rid) ?? "").replace(/^\/?xl\//, "");
        return { name: s.getAttribute("name") ?? "", path: `xl/${target}` };
      })
    : [];
  const lire = (path: string): string[][] => {
    const doc = xml(path);
    if (!doc) return [];
    const rows: string[][] = [];
    for (const row of Array.from(doc.getElementsByTagName("row"))) {
      const cells: string[] = [];
      for (const c of Array.from(row.getElementsByTagName("c"))) {
        const idx = colIndex(c.getAttribute("r") ?? "A1");
        const t = c.getAttribute("t");
        const vEl = c.getElementsByTagName("v")[0];
        let val = vEl?.textContent ?? "";
        if (t === "s") val = shared[Number(val)] ?? "";
        else if (t === "inlineStr") val = Array.from(c.getElementsByTagName("t")).map((x) => x.textContent ?? "").join("");
        cells[idx] = val;
      }
      rows.push(Array.from(cells, (x) => x ?? ""));
    }
    return rows;
  };
  const ordre = [...sheets.filter((s) => /tous/i.test(s.name)), ...sheets.filter((s) => !/tous/i.test(s.name))];
  for (const s of ordre) {
    const rows = lire(s.path);
    if (rows.some((r) => r.some((c) => /^r[ée]f[ée]rence$/i.test(c.trim())))) return rows;
  }
  throw new Error("Aucune feuille avec une colonne « Référence » dans ce fichier.");
}

// Lignes du tableau (Excel ou copier-coller) → dossiers.
export function versDossiers(rows: string[][]): DossierLoan[] {
  const h = rows.findIndex((r) => r.some((c) => /^r[ée]f[ée]rence$/i.test(String(c).trim())));
  if (h < 0) return [];
  const head = rows[h].map((c) => sansAccents(String(c)).toLowerCase().trim());
  const col = (...re: RegExp[]) => head.findIndex((c) => re.some((r) => r.test(c)));
  const iRef = col(/^reference$/);
  const iCli = col(/^client/);
  const iVille = col(/^ville/);
  const iCp = col(/code postal/);
  const iStatut = col(/^statut/);
  const iCat = col(/categorie exacte/, /^categorie/, /niveau/);
  const iMarge = col(/^marge \(/, /^marge$/);
  const iKw = col(/puissance/);
  const num = (s: string) => {
    const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && String(s ?? "").trim() !== "" ? n : null;
  };
  const out: DossierLoan[] = [];
  for (const r of rows.slice(h + 1)) {
    const ref = String(r[iRef] ?? "").trim();
    if (!/^IC-/i.test(ref)) continue;
    const statut = String(r[iStatut] ?? "").trim();
    out.push({
      ref,
      client: String(r[iCli] ?? "").trim(),
      ville: String(r[iVille] ?? "").trim(),
      cp: String(r[iCp] ?? "").trim().padStart(5, "0"),
      statut,
      categorie: iCat >= 0 ? String(r[iCat] ?? "").trim() : "",
      marge: iMarge >= 0 ? num(r[iMarge]) : null,
      kw: iKw >= 0 ? num(r[iKw]) : null,
      inclus: /^(sign|audit)/i.test(sansAccents(statut)),
      fait: /^install/i.test(sansAccents(statut)),
    });
  }
  return out;
}
