// Aperçu des liens partagés (WhatsApp, Facebook, SMS, Google…) : ces robots ne lancent pas le
// JavaScript du site, ils lisent seulement le HTML. Après le build, on écrit donc une copie de
// index.html par page (dist/public/<page>/index.html) avec son titre, sa description, son image
// (client/public/og/*.jpg, faites par scripts/make-og-images.cjs) et son adresse. Firebase sert
// ces fichiers en priorité, puis le site s'affiche normalement.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const BASE = "https://ip5energie.fr";
const DIST = "dist/public";
const html = readFileSync(`${DIST}/index.html`, "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const og = (name) => `${BASE}/og/${name}.jpg`;

const villes = [...readFileSync("client/src/pages/PacVille.tsx", "utf8").matchAll(/slug: "([^"]+)", nom: "([^"]+)"/g)].map((m) => ({ slug: m[1], nom: m[2] }));
const articles = [
  ...readFileSync("client/src/pages/articles-data.ts", "utf8").matchAll(
    /slug: "([^"]+)",\s*title:\s*"((?:[^"\\]|\\.)*)",\s*excerpt:\s*"((?:[^"\\]|\\.)*)"/g,
  ),
].map((m) => ({ slug: m[1], title: m[2].replace(/\\"/g, '"'), excerpt: m[3].replace(/\\"/g, '"') }));

const home = {
  title: "IP5 Énergie — Pompe à chaleur et solaire, avec les aides de l'État",
  description: "Installateur certifié RGE QualiPAC : remplacez votre chaudière fioul ou gaz par une pompe à chaleur. Étude gratuite, aides MaPrimeRénov' et CEE gérées de A à Z.",
  image: og("accueil"),
  alt: "Pompe à chaleur installée devant une maison — IP5 Énergie",
  preload: "/images/hero-accueil.jpg",
};
const simu = {
  title: "Simulez vos aides pour une pompe à chaleur en 2 minutes — IP5 Énergie",
  description: "MaPrimeRénov' et primes CEE : découvrez gratuitement les aides auxquelles vous avez droit pour remplacer votre chauffage par une pompe à chaleur.",
  image: og("simulateur"),
  alt: "Simulateur d'aides pompe à chaleur — IP5 Énergie",
};
const solaire = {
  title: "Chauffe-eau solaire : vérifiez vos aides — IP5 Énergie",
  description: "Produisez votre eau chaude grâce au soleil. Étude gratuite et aides de l'État (MaPrimeRénov', CEE) gérées par IP5 Énergie.",
  image: og("solaire"),
  alt: "Chauffe-eau solaire à tubes — IP5 Énergie",
};

const pages = {
  "/": home,
  "/ip5-energie": home,
  "/pompe-a-chaleur": {
    title: "Nos pompes à chaleur — IP5 Énergie",
    description: "Pompes à chaleur air/eau installées par un professionnel RGE QualiPAC, aides de l'État déduites du devis. Étude gratuite.",
    image: og("pompe-a-chaleur"),
    alt: "Pompe à chaleur air/eau — IP5 Énergie",
  },
  "/pac": simu,
  "/simulateur-pac": simu,
  "/aides-pac": simu,
  "/solaire": solaire,
  "/chauffe-eau-solaire": solaire,
  "/aides": {
    title: "Aides de l'État : MaPrimeRénov' et primes CEE — IP5 Énergie",
    description: "Comprendre MaPrimeRénov', les primes CEE et les autres aides pour votre pompe à chaleur. IP5 Énergie calcule vos droits et monte vos dossiers.",
    image: og("aides"),
    alt: "Aides MaPrimeRénov' et CEE — IP5 Énergie",
  },
  "/realisations": {
    title: "Nos réalisations et avis clients — IP5 Énergie",
    description: "Des installations de pompes à chaleur réelles, réalisées par nos équipes, et l'avis de nos clients.",
    image: og("realisations"),
    alt: "Installation de pompe à chaleur réalisée par IP5 Énergie",
  },
  "/contact": {
    title: "Contact — IP5 Énergie",
    description: "Un projet de pompe à chaleur ou de solaire ? Appelez le 07 49 52 52 67 ou écrivez-nous : étude gratuite et sans engagement.",
    image: og("contact"),
    alt: "Contactez IP5 Énergie",
  },
  "/conseils": {
    title: "Conseils & actus : pompe à chaleur, aides et solaire — IP5 Énergie",
    description: "Conseils pratiques et actualités sur la pompe à chaleur, MaPrimeRénov', les primes CEE et le solaire, expliqués simplement.",
    image: og("conseils"),
    alt: "Conseils & actus — IP5 Énergie",
  },
};
for (const v of villes) {
  pages[`/pompe-a-chaleur/${v.slug}`] = {
    title: `Pompe à chaleur à ${v.nom} — aides et installation | IP5 Énergie`,
    description: `Installation de pompe à chaleur à ${v.nom} par un professionnel RGE. Étude gratuite, aides MaPrimeRénov' et CEE gérées de A à Z.`,
    image: existsSync(`client/public/og/pac-${v.slug}.jpg`) ? og(`pac-${v.slug}`) : og("pompe-a-chaleur"),
    alt: `Pompe à chaleur à ${v.nom} — IP5 Énergie`,
    type: "website",
  };
}
for (const a of articles) {
  const card = `client/public/og/conseils-${a.slug}.jpg`;
  const cover = `client/public/images/articles/${a.slug}.jpg`;
  pages[`/conseils/${a.slug}`] = {
    title: `${a.title} — IP5 Énergie`,
    description: a.excerpt,
    image: existsSync(card) ? og(`conseils-${a.slug}`) : existsSync(cover) ? `${BASE}/images/articles/${a.slug}.jpg` : og("conseils"),
    alt: a.title,
    type: "article",
  };
}

const setMeta = (doc, attr, key, value) => {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/>`);
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return re.test(doc) ? doc.replace(re, tag) : doc.replace("</head>", `    ${tag}\n  </head>`);
};

let count = 0;
for (const [route, p] of Object.entries(pages)) {
  const url = `${BASE}${route === "/" ? "/" : route}`;
  let doc = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/s, `<meta name="description" content="${esc(p.description)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/s, `<meta property="og:description" content="${esc(p.description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`);
  doc = setMeta(doc, "property", "og:title", p.title);
  doc = setMeta(doc, "property", "og:type", p.type ?? "website");
  doc = setMeta(doc, "property", "og:url", url);
  doc = setMeta(doc, "property", "og:image", p.image);
  doc = setMeta(doc, "property", "og:image:width", "1200");
  doc = setMeta(doc, "property", "og:image:height", "630");
  doc = setMeta(doc, "property", "og:image:alt", p.alt);
  doc = setMeta(doc, "name", "twitter:image", p.image);
  // Accueil : la photo du haut est demandée dès la lecture du HTML (avant le JavaScript),
  // pour qu'elle s'affiche en même temps que la page.
  if (p.preload) doc = doc.replace("</head>", `    <link rel="preload" as="image" href="${p.preload}" fetchpriority="high" />\n  </head>`);
  const file = route === "/" ? `${DIST}/index.html` : `${DIST}${route}/index.html`;
  mkdirSync(file.replace(/\/index\.html$/, ""), { recursive: true });
  writeFileSync(file, doc);
  count++;
}
console.log(`Aperçus de liens : ${count} pages écrites.`);
