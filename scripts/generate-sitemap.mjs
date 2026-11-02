// Génère dist/public/sitemap.xml après le build : pages fixes + tous les
// articles trouvés dans articles-data.ts (y compris ceux publiés chaque
// lundi par la routine automatique).
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://ip5energie.fr";
const today = new Date().toISOString().slice(0, 10);

const source = readFileSync("client/src/pages/articles-data.ts", "utf8");
const articles = [...source.matchAll(/slug:\s*"([^"]+)"[\s\S]*?date:\s*"([^"]+)"/g)].map(
  (m) => ({ slug: m[1], date: m[2] }),
);

// Pages « Pompe à chaleur à <ville> » (liste VILLES de PacVille.tsx).
const villes = [...readFileSync("client/src/pages/PacVille.tsx", "utf8").matchAll(/\{\s*slug:\s*"([^"]+)",\s*nom:/g)].map((m) => m[1]);

const urls = [
  { loc: "/", lastmod: today, priority: "1.0" },
  { loc: "/pompe-a-chaleur", lastmod: today, priority: "0.9" },
  { loc: "/solaire", lastmod: today, priority: "0.9" },
  { loc: "/aides", lastmod: today, priority: "0.9" },
  { loc: "/realisations", lastmod: today, priority: "0.8" },
  { loc: "/contact", lastmod: today, priority: "0.7" },
  ...villes.map((v) => ({ loc: `/pompe-a-chaleur/${v}`, lastmod: today, priority: "0.6" })),
  { loc: "/conseils", lastmod: today, priority: "0.8" },
  ...articles.map((a) => ({
    loc: `/conseils/${a.slug}`,
    lastmod: a.date,
    priority: "0.7",
  })),
  { loc: "/mentions-legales", lastmod: today, priority: "0.3" },
  { loc: "/confidentialite", lastmod: today, priority: "0.3" },
];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map(
      (u) =>
        `  <url><loc>${BASE}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`,
    )
    .join("\n") +
  `\n</urlset>\n`;

writeFileSync("dist/public/sitemap.xml", xml);
console.log(`sitemap.xml généré (${urls.length} URLs, dont ${articles.length} articles)`);
