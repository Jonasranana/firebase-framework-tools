// Fabrique les images d'aperçu des liens (WhatsApp, Facebook, SMS…) : 1200 × 630, une par page.
// Le sujet est centré pour rester joli quand WhatsApp recadre en carré.
// À lancer en local quand on change une image : node scripts/make-og-images.cjs
// (sortie : client/public/og/*.jpg, servies ensuite par scripts/generate-og-pages.mjs).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "scripts/og-sources");
const PUB = path.join(ROOT, "client/public");
const OUT = path.join(PUB, "og");
fs.mkdirSync(OUT, { recursive: true });

const villes = [...fs.readFileSync(path.join(ROOT, "client/src/pages/PacVille.tsx"), "utf8").matchAll(/slug: "([^"]+)", nom: "([^"]+)"/g)].map((m) => ({ slug: m[1], nom: m[2] }));
const articles = [...fs.readFileSync(path.join(ROOT, "client/src/pages/articles-data.ts"), "utf8").matchAll(/slug: "([^"]+)",[\s\S]*?category: "([^"]+)"/g)].map((m) => ({ slug: m[1], category: m[2] }));

const pages = [
  { name: "accueil", photo: "photo-03.png", pos: "50% 50%", title: "Pompe à chaleur<br>& solaire", sub: "Installateur RGE · Aides de l'État · Étude gratuite" },
  { name: "pompe-a-chaleur", photo: "photo-03.png", pos: "50% 50%", title: "Nos pompes<br>à chaleur", sub: "Installation RGE QualiPAC · Aides déduites du devis" },
  { name: "simulateur", photo: "photo-03.png", pos: "50% 50%", title: "Simulez vos aides<br>en 2 minutes", sub: "MaPrimeRénov' · Primes CEE · Gratuit" },
  { name: "solaire", photo: "photo-07.png", pos: "50% 45%", title: "Chauffe-eau<br>solaire", sub: "Eau chaude grâce au soleil · Aides de l'État" },
  { name: "aides", photo: "photo-06.png", pos: "50% 50%", title: "MaPrimeRénov'<br>& primes CEE", sub: "Vos aides calculées et gérées par IP5 Énergie" },
  { name: "realisations", photo: "../../client/public/images/realisations/interieur-pac-ballon.jpg", pos: "50% 40%", title: "Nos<br>réalisations", sub: "Des installations réelles, posées par nos équipes" },
  { name: "contact", photo: "photo-02.png", pos: "50% 35%", title: "Parlons de<br>votre projet", sub: "07 49 52 52 67 · Étude gratuite" },
  { name: "conseils", photo: "photo-01.png", pos: "50% 40%", title: "Conseils<br>& actus", sub: "Pompe à chaleur, aides, solaire : nos articles" },
  ...villes.map((v) => ({ name: `pac-${v.slug}`, photo: "photo-03.png", pos: "50% 50%", title: `Pompe à chaleur<br>à ${v.nom}`, sub: "Installateur RGE · Aides de l'État · Étude gratuite" })),
];

const logo = "file://" + path.join(PUB, "images/email/logo-ip5-energie.png");
const card = (photoUrl, pos, inner) => `<body style="margin:0;font-family:Inter,Arial,sans-serif">
<div style="position:relative;width:1200px;height:630px;overflow:hidden;background:#0f2b4a">
  <img src="${photoUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${pos}">
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,43,74,.15) 0%,rgba(15,43,74,.35) 45%,rgba(10,25,45,.88) 100%)"></div>
  <div style="position:absolute;top:34px;left:50%;transform:translateX(-50%);background:#fff;border-radius:18px;padding:12px 22px;box-shadow:0 8px 24px rgba(0,0,0,.25)">
    <img src="${logo}" style="height:46px;display:block">
  </div>
  ${inner}
</div></body>`;
const pageInner = (p) => `<div style="position:absolute;left:0;right:0;bottom:46px;text-align:center;color:#fff">
    <div style="font-size:64px;font-weight:800;line-height:1.05;letter-spacing:-1px;text-shadow:0 4px 18px rgba(0,0,0,.45)">${p.title}</div>
    <div style="display:inline-block;margin-top:18px;font-size:24px;font-weight:700;background:linear-gradient(90deg,#ff8a00,#e0218a);padding:10px 22px;border-radius:999px">${p.sub}</div>
  </div>`;
const articleInner = (cat) => `<div style="position:absolute;left:0;right:0;bottom:40px;text-align:center">
    <span style="display:inline-block;font-size:26px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#fff;background:linear-gradient(90deg,#ff8a00,#e0218a);padding:10px 24px;border-radius:999px">${cat}</span>
  </div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const shoot = async (html, out) => {
    const tmp = path.join(OUT, "_tmp.html");
    fs.writeFileSync(tmp, html);
    await p.goto("file://" + tmp);
    await p.waitForTimeout(250);
    await p.screenshot({ path: out, type: "jpeg", quality: 84 });
    fs.unlinkSync(tmp);
  };
  for (const pg of pages) await shoot(card("file://" + path.join(SRC, pg.photo), pg.pos, pageInner(pg)), path.join(OUT, `${pg.name}.jpg`));
  for (const a of articles) {
    const cover = path.join(PUB, "images/articles", `${a.slug}.jpg`);
    if (!fs.existsSync(cover)) continue;
    await shoot(card("file://" + cover, "50% 50%", articleInner(a.category)), path.join(OUT, `conseils-${a.slug}.jpg`));
  }
  await b.close();
  console.log(`${pages.length} pages + ${articles.length} articles → client/public/og/`);
})();
