// Lecture seule : résumé des mesures du chronomètre invisible (crm_perf), par personne et par appareil.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const snap = await getFirestore().collection("crm_perf").get();
const premier = snap.docs.map((d) => d.get("at")).sort()[0];
console.log(`Lots reçus : ${snap.size} · depuis ${premier}`);
const DEPUIS = "2026-11-27T06:13:00Z"; // mise en ligne des mesures précises (#410)
for (const [titre, docs] of [["TOUT", snap.docs], [`DEPUIS ${DEPUIS}`, snap.docs.filter((d) => String(d.get("at")) >= DEPUIS)]]) {
console.log(`\n===== ${titre} : ${docs.length} lots =====`);
const par = {}; const gels = {}; const apps = {};
for (const d of docs) {
  const x = d.data(); const qui = (x.email || "?").split("@")[0]; const app = x.appareil?.mobile ? "tel" : "ordi"; const k0 = `${qui}/${app}`;
  apps[k0] = `${x.appareil?.navigateur} · ${x.appareil?.coeurs} coeurs · ${x.appareil?.memoire ?? "?"} Go · ${x.appareil?.reseau ?? "?"}`;
  gels[k0] = gels[k0] || { nb: 0, ms: 0 }; gels[k0].nb += x.gels?.nb || 0; gels[k0].ms += x.gels?.ms || 0;
  for (const m of x.mesures || []) (par[`${m.n} · ${k0}`] = par[`${m.n} · ${k0}`] || []).push(m);
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
for (const [k, ms] of Object.entries(par).sort()) {
  const v = ms.map((m) => m.ms);
  let extra = "";
  if (k.startsWith("changement-page")) {
    const pages = {}; for (const m of ms) (pages[m.x] = pages[m.x] || []).push(m.ms);
    extra = " | " + Object.entries(pages).map(([p, a]) => `${p}=${q(a, 0.5)}ms(${a.length})`).join(", ");
  }
  else if (!k.startsWith("defilement") && ms.some((m) => m.x !== undefined)) {
    const xs = {}; for (const m of ms) (xs[m.x] = xs[m.x] || []).push(m.ms);
    extra = " | " + Object.entries(xs).map(([p, a]) => `${p}=${q(a, 0.5)}ms(${a.length})`).join(", ");
  }
  if (k.startsWith("defilement")) { const sac = ms.filter((m) => !/^0\//.test(String(m.x))).length; extra = ` | défilements avec saccades : ${sac}/${ms.length}`; }
  console.log(`${k} : ${v.length}× · médiane ${q(v, 0.5)} ms · 90 % sous ${q(v, 0.9)} ms · pire ${Math.max(...v)} ms${extra}`);
}
console.log("Gels (tâches > 50 ms) :", JSON.stringify(gels));
for (const [k, a] of Object.entries(apps)) console.log("Appareil", k, ":", a);
}
