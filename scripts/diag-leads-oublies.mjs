// LECTURE SEULE : leads oubliés pendant la panne de facturation Google (fonctions arrêtées).
// 1) Demandes du site (ip5_leads) depuis DEPUIS sans fiche CRM correspondante (crm_leads/<même id>).
// 2) Prospects Meta (formulaires instantanés) depuis DEPUIS absents du CRM (crm_leads/fb_<id>).
// 3) Fiches CRM créées par jour, par source (pour dater la panne).
// N'écrit rien, n'envoie rien.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const DEPUIS = new Date(process.env.DEPUIS || "2026-10-25T00:00:00Z");
const mask = (p) => String(p ?? "").replace(/\s/g, "").replace(/^(.{4}).*(.{2})$/, "$1•••$2");
const day = (d) => d?.toISOString?.().slice(0, 10) ?? "?";

const crm = await db.collection("crm_leads").where("createdAt", ">=", DEPUIS).get();
const ids = new Set(crm.docs.map((d) => d.id));
const parJour = {};
for (const d of crm.docs) {
  const x = d.data();
  const k = `${day(x.createdAt?.toDate?.())} ${x.source ?? "?"}`;
  parJour[k] = (parJour[k] ?? 0) + 1;
}
console.log("=== Fiches CRM créées par jour et source ===");
for (const k of Object.keys(parJour).sort()) console.log(`  ${k} : ${parJour[k]}`);

console.log("\n=== Fiches Facebook déjà dans le CRM ===");
for (const d of crm.docs.filter((d) => d.data().source === "formulaire-facebook"))
  console.log(`  ${day(d.data().createdAt?.toDate?.())} | ${d.id} | ${d.data().name} | ${mask(d.data().phone)}`);

const site = await db.collection("ip5_leads").where("createdAt", ">=", DEPUIS).get();
console.log(`\n=== Demandes du site depuis ${day(DEPUIS)} : ${site.size} ===`);
let manquants = 0;
for (const d of site.docs) {
  const x = d.data();
  const ok = ids.has(d.id);
  const t = x.createdAt?.toDate?.()?.toISOString().slice(0, 16);
  if (!ok) manquants++;
  console.log(`  ${ok ? "OK " : "❌ MANQUE"} | ${t} | id ${d.id} | ${x.nomComplet || x.name || "?"} | ${mask(x.telephone || x.phone)} | mail ${x.email ? "oui" : "non"} | ${x.source || ""} | ${x.housingType || ""}`);
}
console.log(`→ ${manquants} demande(s) du site sans fiche CRM`);

// Meta
const { META_PAGE_TOKEN: TOKEN } = process.env;
if (!TOKEN) {
  console.log("\n(Meta : jeton absent, vérification Facebook sautée)");
} else {
  const G = "https://graph.facebook.com/v21.0";
  const g = async (p) => {
    const r = await fetch(`${G}/${p}${p.includes("?") ? "&" : "?"}access_token=${TOKEN}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    return j;
  };
  try {
    const PAGE = "1204167486109387";
    const forms = (await g(`${PAGE}/leadgen_forms?fields=id,name,status&limit=100`)).data ?? [];
    console.log(`\n=== Formulaires Facebook : ${forms.length} ===`);
    let manqueFb = 0, total = 0;
    const since = Math.floor(DEPUIS.getTime() / 1000);
    for (const f of forms) {
      let url = `${f.id}/leads?fields=id,created_time,field_data&limit=100&filtering=${encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]))}`;
      while (url) {
        const j = await g(url);
        for (const l of j.data ?? []) {
          total++;
          const ok = ids.has(`fb_${l.id}`);
          const fd = Object.fromEntries((l.field_data ?? []).map((x) => [x.name, (x.values ?? [])[0]]));
          const nom = fd.full_name || fd.nom_complet || fd["nom_complet"] || Object.entries(fd).find(([k]) => /nom|name/i.test(k))?.[1] || "?";
          const tel = Object.entries(fd).find(([k]) => /phone|t[ée]l[ée]phone|num/i.test(k))?.[1];
          if (!ok) manqueFb++;
          console.log(`  ${ok ? "OK " : "❌ MANQUE"} | ${l.created_time} | fb_${l.id} | ${nom} | ${mask(tel)} | form « ${f.name} » (${f.status})`);
        }
        url = j.paging?.next ? j.paging.next.replace(`${G}/`, "").replace(/&?access_token=[^&]+/, "") : null;
      }
    }
    console.log(`→ ${total} prospect(s) Facebook depuis ${day(DEPUIS)}, dont ${manqueFb} absent(s) du CRM`);
  } catch (e) {
    console.log("Meta : erreur " + e.message);
  }
}
