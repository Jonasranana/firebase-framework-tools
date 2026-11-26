// Lecture seule : résumé des mesures du chronomètre invisible (crm_perf).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const snap = await getFirestore().collection("crm_perf").get();
console.log(`Lots reçus : ${snap.size}`);
const par = {}; const gels = {}; const apps = {};
for (const d of snap.docs) {
  const x = d.data(); const qui = (x.email || "?").split("@")[0]; const app = x.appareil?.mobile ? "tel" : "ordi";
  apps[`${qui}/${app}`] = JSON.stringify(x.appareil);
  gels[`${qui}/${app}`] = gels[`${qui}/${app}`] || { nb: 0, ms: 0 };
  gels[`${qui}/${app}`].nb += x.gels?.nb || 0; gels[`${qui}/${app}`].ms += x.gels?.ms || 0;
  for (const m of x.mesures || []) {
    const k = `${m.n} · ${qui}/${app}`; (par[k] = par[k] || []).push(m);
  }
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const [k, ms] of Object.entries(par).sort()) {
  const v = ms.map((m) => m.ms);
  const extra = k.startsWith("changement-page") ? " pages: " + [...new Set(ms.map((m) => `${m.x}=${m.ms}`))].slice(0, 12).join(", ") : k.startsWith("defilement") ? " ex: " + ms.slice(-4).map((m) => `${m.ms}ms(${m.x})`).join(" | ") : "";
  console.log(`${k} : ${v.length} fois · médiane ${med(v)} ms · pire ${Math.max(...v)} ms${extra}`);
}
console.log("Gels :", JSON.stringify(gels));
console.log("Appareils :", JSON.stringify(apps));
