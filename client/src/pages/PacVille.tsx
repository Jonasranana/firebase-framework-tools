import React, { useEffect } from "react";
import { ShieldCheck, CheckCircle2, ArrowRight, Phone, MapPin, ClipboardCheck, Home, FileText, Wrench, Thermometer } from "lucide-react";
import { PageLayout, Simulator, TrustBar } from "./ip5-sections";

// ─────────────────────────────────────────────────────────────────────────
// Pages locales « Pompe à chaleur à <ville> » (référencement Google local).
// Chaque page a son titre, sa description et son contenu propres : département,
// zone climatique (H1 / H2, les départements en zone H3 sont exclus), et le
// simulateur avec une source dédiée pour mesurer d'où viennent les demandes.
// ─────────────────────────────────────────────────────────────────────────
type Ville = { slug: string; nom: string; dep: string; depNom: string; zone: "H1" | "H2"; region: string };

export const VILLES: Ville[] = [
  { slug: "nantes", nom: "Nantes", dep: "44", depNom: "Loire-Atlantique", zone: "H2", region: "Pays de la Loire" },
  { slug: "lyon", nom: "Lyon", dep: "69", depNom: "Rhône", zone: "H1", region: "Auvergne-Rhône-Alpes" },
  { slug: "bordeaux", nom: "Bordeaux", dep: "33", depNom: "Gironde", zone: "H2", region: "Nouvelle-Aquitaine" },
  { slug: "paris", nom: "Paris", dep: "75", depNom: "Paris", zone: "H1", region: "Île-de-France" },
  { slug: "lille", nom: "Lille", dep: "59", depNom: "Nord", zone: "H1", region: "Hauts-de-France" },
  { slug: "rennes", nom: "Rennes", dep: "35", depNom: "Ille-et-Vilaine", zone: "H2", region: "Bretagne" },
  { slug: "strasbourg", nom: "Strasbourg", dep: "67", depNom: "Bas-Rhin", zone: "H1", region: "Grand Est" },
  { slug: "toulouse", nom: "Toulouse", dep: "31", depNom: "Haute-Garonne", zone: "H2", region: "Occitanie" },
  { slug: "tours", nom: "Tours", dep: "37", depNom: "Indre-et-Loire", zone: "H2", region: "Centre-Val de Loire" },
  { slug: "angers", nom: "Angers", dep: "49", depNom: "Maine-et-Loire", zone: "H2", region: "Pays de la Loire" },
  { slug: "dijon", nom: "Dijon", dep: "21", depNom: "Côte-d'Or", zone: "H1", region: "Bourgogne-Franche-Comté" },
  { slug: "rouen", nom: "Rouen", dep: "76", depNom: "Seine-Maritime", zone: "H1", region: "Normandie" },
  { slug: "orleans", nom: "Orléans", dep: "45", depNom: "Loiret", zone: "H1", region: "Centre-Val de Loire" },
  { slug: "clermont-ferrand", nom: "Clermont-Ferrand", dep: "63", depNom: "Puy-de-Dôme", zone: "H1", region: "Auvergne-Rhône-Alpes" },
  { slug: "metz", nom: "Metz", dep: "57", depNom: "Moselle", zone: "H1", region: "Grand Est" },
  { slug: "reims", nom: "Reims", dep: "51", depNom: "Marne", zone: "H1", region: "Grand Est" },
  { slug: "caen", nom: "Caen", dep: "14", depNom: "Calvados", zone: "H1", region: "Normandie" },
  { slug: "le-mans", nom: "Le Mans", dep: "72", depNom: "Sarthe", zone: "H2", region: "Pays de la Loire" },
  { slug: "grenoble", nom: "Grenoble", dep: "38", depNom: "Isère", zone: "H1", region: "Auvergne-Rhône-Alpes" },
  { slug: "saint-etienne", nom: "Saint-Étienne", dep: "42", depNom: "Loire", zone: "H1", region: "Auvergne-Rhône-Alpes" },
  { slug: "poitiers", nom: "Poitiers", dep: "86", depNom: "Vienne", zone: "H2", region: "Nouvelle-Aquitaine" },
  { slug: "limoges", nom: "Limoges", dep: "87", depNom: "Haute-Vienne", zone: "H1", region: "Nouvelle-Aquitaine" },
];

const ZONE_TEXT: Record<"H1" | "H2", string> = {
  H1: "Votre département est en zone climatique H1, la plus froide de France métropolitaine hors montagne : une pompe à chaleur air/eau bien dimensionnée y est particulièrement pertinente pour remplacer une chaudière fioul ou gaz.",
  H2: "Votre département est en zone climatique H2, aux hivers modérés : les pompes à chaleur air/eau y travaillent dans d'excellentes conditions de rendement.",
};

const STEPS = [
  { icon: ClipboardCheck, title: "Étude de votre projet", text: "Vous répondez à quelques questions. Un conseiller vous rappelle pour vérifier votre éligibilité aux aides." },
  { icon: Home, title: "Visite technique", text: "Un professionnel étudie votre logement et définit la pompe à chaleur adaptée." },
  { icon: FileText, title: "Dossiers d'aides", text: "Nous montons vos dossiers MaPrimeRénov' et CEE. Les aides sont déduites de votre devis." },
  { icon: Wrench, title: "Installation certifiée", text: "La pose est réalisée par un artisan certifié RGE, puis nous restons votre interlocuteur." },
];

function PageVille({ v }: { v: Ville }) {
  // Description et lien canonique propres à la ville (référencement).
  useEffect(() => {
    const desc = `Pompe à chaleur à ${v.nom} (${v.depNom}) : étude gratuite, aides MaPrimeRénov' et CEE gérées par IP5 Énergie, installation par des artisans certifiés RGE QualiPAC.`;
    let m = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!m) {
      m = document.createElement("meta");
      m.name = "description";
      document.head.appendChild(m);
    }
    m.content = desc;
    let c = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!c) {
      c = document.createElement("link");
      c.rel = "canonical";
      document.head.appendChild(c);
    }
    c.href = `https://ip5energie.fr/pompe-a-chaleur/${v.slug}`;
  }, [v]);

  const autres = VILLES.filter((x) => x.slug !== v.slug).slice(0, 12);
  return (
    <PageLayout title={`Pompe à chaleur à ${v.nom} — aides et installation | IP5 Énergie`}>
      <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-24 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-6 mb-12 lg:mb-0 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-white dark:bg-slate-900 text-[#173a5e] dark:text-blue-200 font-semibold text-sm mb-6 border border-slate-200 dark:border-slate-700">
                <MapPin size={16} className="text-[#2b5a8f] dark:text-blue-300" /> {v.nom} et {v.depNom}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.12] mb-6 text-[#0f2a47] dark:text-white">
                Pompe à chaleur à {v.nom} : jusqu'à 100&nbsp;% d'aides
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                IP5 Énergie étudie votre projet à {v.nom}, prépare vos dossiers{" "}
                <b className="font-semibold text-slate-800 dark:text-slate-100">MaPrimeRénov'</b> et{" "}
                <b className="font-semibold text-slate-800 dark:text-slate-100">CEE</b>, puis fait installer votre pompe à chaleur par des
                artisans certifiés RGE. Un seul interlocuteur du début à la fin.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <a
                  href="#simulateur"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("simulateur")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="inline-flex items-center justify-center gap-2.5 bg-[#173a5e] hover:bg-[#122f4d] text-white px-7 py-3.5 rounded-lg font-semibold shadow-md transition-colors"
                >
                  Estimer mes aides gratuitement <ArrowRight size={18} />
                </a>
                <a
                  href="tel:+33749525267"
                  className="inline-flex items-center justify-center gap-2.5 bg-white dark:bg-slate-900 text-[#173a5e] dark:text-blue-200 px-7 py-3.5 rounded-lg font-semibold border border-slate-300 dark:border-slate-600"
                >
                  <Phone size={18} /> 07 49 52 52 67
                </a>
              </div>
              <p className="mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap justify-center lg:justify-start text-sm text-slate-500 dark:text-slate-400">
                {["Étude gratuite", "Sans engagement", "Rappel par un conseiller"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="text-[#2b5a8f] dark:text-blue-300" size={16} /> {t}
                  </span>
                ))}
              </p>
            </div>
            <div id="simulateur" className="lg:col-span-6 scroll-mt-28">
              <Simulator tone="pro" source={`landing-pac-${v.slug}`} />
            </div>
          </div>
        </div>
      </section>

      <TrustBar />

      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0f2a47] dark:text-white mb-5">Se chauffer avec une pompe à chaleur à {v.nom}</h2>
          <div className="flex items-start gap-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-6">
            <Thermometer className="text-[#2b5a8f] dark:text-blue-300 shrink-0 mt-1" size={22} />
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              <b className="text-[#0f2a47] dark:text-white">{v.nom} ({v.dep}), zone {v.zone}.</b> {ZONE_TEXT[v.zone]}
            </p>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
            Les aides de l'État — MaPrimeRénov' et les Certificats d'Économies d'Énergie (CEE) — peuvent financer une grande partie de
            l'installation d'une pompe à chaleur en remplacement d'une chaudière fioul ou gaz. Le montant dépend de votre foyer, de vos revenus et de votre
            logement : notre simulateur vous donne une estimation gratuite en quelques questions, et un conseiller vous rappelle pour la confirmer.
          </p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Vous n'avez pas à chercher d'artisan ni à monter les dossiers : IP5 Énergie coordonne l'étude, la visite technique, les demandes d'aides
            et la pose par un installateur certifié RGE QualiPAC, sur {v.nom} et dans toute la région {v.region}.
          </p>
        </div>
      </section>

      <section className="py-16 bg-slate-50 dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0f2a47] dark:text-white mb-8">Un projet suivi de A à Z</h2>
          <ol className="grid md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="w-10 h-10 rounded-lg bg-[#173a5e] text-white flex items-center justify-center">
                    <s.icon size={20} />
                  </span>
                  <span className="text-sm font-semibold text-slate-400">0{i + 1}</span>
                </div>
                <h3 className="font-semibold text-[#0f2a47] dark:text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-14 bg-white dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2b5a8f] dark:text-blue-300 mb-4">
            <ShieldCheck size={16} /> Nous intervenons aussi près de chez vous
          </p>
          <div className="flex flex-wrap gap-2">
            {autres.map((x) => (
              <a
                key={x.slug}
                href={`/pompe-a-chaleur/${x.slug}`}
                className="text-sm px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Pompe à chaleur à {x.nom}
              </a>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-400">
            IP5 CONSEILS — SIREN 890 293 277 — Installation réservée aux logements hors zone climatique H3 (pourtour méditerranéen et Corse).
          </p>
        </div>
      </section>
    </PageLayout>
  );
}

// Route dynamique : /pompe-a-chaleur/<ville> ; une ville inconnue affiche la page nationale.
export default function PacVille({ params }: { params: { ville: string } }) {
  const v = VILLES.find((x) => x.slug === params.ville);
  if (!v) {
    window.location.replace("/pompe-a-chaleur");
    return null;
  }
  return <PageVille v={v} />;
}
