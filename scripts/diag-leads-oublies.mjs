// LECTURE SEULE : leads oubliés pendant la panne de facturation Google (fonctions arrêtées).
// 1) Demandes du site (ip5_leads) depuis DEPUIS sans fiche CRM correspondante (crm_leads/<même id>).
// 2) Prospects Meta (formulaires instantanés) depuis DEPUIS absents du CRM (crm_leads/fb_<id>).
// 3) Fiches CRM créées par jour, par source (pour dater la panne).
// N'écrit rien, n'envoie rien. (période réglable)
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
const norm = (t) => { const d = String(t ?? "").replace(/\D/g, ""); return d.length >= 9 ? d.slice(-9) : ""; };
const tels = new Set(crm.docs.map((d) => norm(d.data().phone)).filter(Boolean));
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

// Recherche par nom dans TOUT le CRM (prospects vus dans le Centre de prospects Meta).
{
  const NOMS = ["edith bertouin", "bernuchon", "kandjee", "clemence vallee", "gerard malen", "devaud", "claire claire", "gerard le boursicot", "yannic", "myriam serres", "thierry dame", "nicole courault", "gury", "celine riffard", "christiane gratien", "michele dabrowski", "regis fumat", "marie armand", "martine dubreuil"];
  const n = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const tout = await db.collection("crm_leads").select("name", "source", "createdAt", "deletedAt", "deletedBy", "phone", "status", "group", "fields", "notes").get();
  console.log(`\n=== Recherche par nom dans tout le CRM (${tout.size} fiches) ===`);
  for (const nom of NOMS) {
    const hits = tout.docs.filter((d) => n(d.data().name).includes(n(nom)));
    console.log(`  ${hits.length ? "TROUVÉ" : "❌ ABSENT"} | ${nom} | ${hits.map((d) => `${d.id} (${d.data().source ?? "?"}, ${day(d.data().createdAt?.toDate?.())}${(() => { const x = d.data(); const nn = (x.notes ?? []).filter((n) => n.kind !== "statut"); const last = nn.length ? String(nn[nn.length - 1].text).slice(0, 80).replace(/\s+/g, " ") : ""; return ` | statut ${x.status ?? "?"} | groupe ${x.group ?? "?"} | étape ${x.fields?.c_sxgefs ?? "-"} | attribué ${x.fields?.attribue ?? "-"} | rappel ${x.rappelLe ?? ""} | ${nn.length} note(s)${last ? ` « ${last} »` : ""}`; })()}${d.data().deletedAt ? `, supprimée le ${String(d.data().deletedAt?.toDate?.()?.toISOString?.() ?? d.data().deletedAt).slice(0, 16)} par ${d.data().deletedBy ?? "?"}, statut ${d.data().status ?? "?"}` : ""})`).join(" ; ")}`);
  }
}

// Noms lisibles des étiquettes et étapes (codes o_… / e_…).
{
  const want = ["o_e4hsn", "o_ef1qw", "o_z95tk", "o_yt99h", "o_kwz13", "o_giqr7", "o_vjwbo", "e_propal", "e_propal_recue"];
  const walk = (v, path = "") => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") {
      const k = v.key ?? v.id;
      if (want.includes(k)) console.log(`  ${k} = ${v.label ?? v.title ?? v.name ?? JSON.stringify(v).slice(0, 80)}`);
      for (const [kk, vv] of Object.entries(v)) walk(vv, `${path}.${kk}`);
    }
  };
  console.log("\n=== Noms des étiquettes ===");
  for (const d of (await db.collection("crm_boards").get()).docs) walk(d.data());
  for (const d of (await db.collection("crm_config").get().catch(() => ({ docs: [] }))).docs) walk(d.data());
}

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
  let TOK = TOKEN;
  const g = async (p) => {
    const r = await fetch(`${G}/${p}${p.includes("?") ? "&" : "?"}access_token=${TOK}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    return j;
  };
  try {
    const PAGE = "1204167486109387";
    const pg = ((await g(`me/accounts?fields=id,access_token`)).data ?? []).find((x) => x.id === PAGE);
    if (pg?.access_token) TOK = pg.access_token;
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
          const fd = Object.fromEntries((l.field_data ?? []).map((x) => [x.name, (x.values ?? [])[0]]));
          const nom = fd.full_name || fd.nom_complet || fd["nom_complet"] || Object.entries(fd).find(([k]) => /nom|name/i.test(k))?.[1] || "?";
          const tel = Object.entries(fd).find(([k]) => /phone|t[ée]l[ée]phone|num/i.test(k))?.[1];
          const ok = ids.has(`fb_${l.id}`) || (norm(tel) && tels.has(norm(tel)));
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

// Clients signés (étiquette ou groupe contenant « sign ») : données dispo pour Zone + Profil.
{
  const labels = {};
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const k = v.key ?? v.id;
      const t = v.label ?? v.title ?? v.name;
      if (typeof k === "string" && typeof t === "string") labels[k] = t;
      Object.values(v).forEach(walk);
    }
  };
  for (const d of (await db.collection("crm_boards").get()).docs) walk(d.data());
  const tout = await db.collection("crm_leads").select("name", "status", "group", "postalCode", "fields", "deletedAt").get();
  const L = (k) => labels[k] ?? k ?? "";
  const signes = tout.docs.filter((d) => !d.data().deletedAt && (/sign/i.test(L(d.data().status)) || /sign/i.test(L(d.data().group))));
  console.log(`\n=== Clients signés : ${signes.length} ===`);
  let ok = 0;
  for (const d of signes) {
    const x = d.data(), f = x.fields ?? {};
    const rev = String(f.revenuFiscal ?? "").trim(), foy = String(f.foyerCalc ?? "").trim(), tr = String(f.tranche ?? "").trim();
    if (x.postalCode && ((rev && foy) || tr)) ok++;
    console.log(`  ${x.name} | statut « ${L(x.status)} » | groupe « ${L(x.group)} » | CP ${x.postalCode ? "oui" : "NON"} | revenu ${rev ? "oui" : "non"} | foyer ${foy ? "oui" : "non"} | tranche site « ${tr} »`);
  }
  console.log(`→ ${ok}/${signes.length} avec code postal + profil calculable`);
}

// Praimy (lecture seule) : état de la connexion (relance) et nombre de dossiers, sans aucune donnée client.
{
  const key = String(process.env.PRAIMY_API_KEY ?? "").trim();
  if (!key) console.log("\n(Praimy : clé absente)");
  else {
    try {
      const r = await fetch("https://portail.praimy.fr/api/v1/dossiers/", { headers: { "X-API-Key": key, Accept: "application/json" } });
      let j = null; try { j = await r.json(); } catch {}
      const items = Array.isArray(j) ? j : j?.items ?? [];
      console.log(`\n=== Praimy : HTTP ${r.status} | ${items.length} dossier(s) | total annoncé ${j?.total ?? j?.count ?? "?"} ===`);
      if (items[0]) console.log(`noms des champs : ${Object.keys(items[0]).join(", ")}`);
      const n = (k) => items.filter((d) => d[k] !== null && d[k] !== undefined && d[k] !== "").length;
      console.log(`remplis : prime_cee ${n("prime_cee")} | mpr_amount_eur ${n("mpr_amount_eur")}`);
    } catch (e) {
      console.log("Praimy : erreur " + e.message);
    }
  }
}

// Essai à blanc Praimy → colonne « Zone + Profil » (compteurs seulement, aucune donnée client).
{
  const key = String(process.env.PRAIMY_API_KEY ?? "").trim();
  if (key) {
    const all = new Map(); let total = Infinity;
    for (let p = 1; p <= 20 && all.size < total; p++) {
      const r = await fetch(`https://portail.praimy.fr/api/v1/dossiers/${p > 1 ? `?page=${p}` : ""}`, { headers: { "X-API-Key": key, Accept: "application/json" } });
      if (!r.ok) break;
      const j = await r.json(); const it = Array.isArray(j) ? j : j.items ?? [];
      total = Number(j.total ?? it.length); const b = all.size; it.forEach((d) => all.set(d.id, d)); if (all.size === b) break;
    }
    const ds = [...all.values()];
    const H3 = ["06","11","13","20","30","34","66","83"], H2 = ["04","07","09","12","16","17","18","22","24","26","28","29","31","32","33","35","36","37","40","41","44","46","47","48","49","50","53","56","61","64","65","72","79","81","82","84","85","86"];
    const cache = new Map();
    const depOf = async (d) => {
      const v = String(d.client_ville || d.ville || "").trim(); if (!v) return "";
      if (!cache.has(v)) { try { const r = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(v)}&fields=codeDepartement&boost=population&limit=1`); cache.set(v, String((await r.json())?.[0]?.codeDepartement || "")); } catch { cache.set(v, ""); } }
      return cache.get(v);
    };
    for (const d of ds) d._dep = await depOf(d);
    const zp = (d) => {
      const dep = d._dep; const z = !dep ? "" : H3.includes(dep) ? "H3" : H2.includes(dep) ? "H2" : "H1";
      const raw = d.mpr_octroi_eur ?? d.mpr_amount_eur, mpr = Math.round(+raw || 0);
      const pr = mpr === 5000 ? "bleu" : mpr === 4000 ? "jaune" : mpr === 3000 ? "classique" : (typeof raw === "number" && mpr === 0 && +d.prime_cee > 0) ? "classique" : "";
      return { cp: !!dep, z, pr, ok: !!(z && pr) };
    };
    const leads = (await db.collection("crm_leads").select("name", "status", "deletedAt", "fields", "praimyClientId").get()).docs.filter((d) => !d.data().deletedAt).map((d) => ({ id: d.id, ...d.data() }));
    const find = (d) => { const c = (d.client_nom || "").toLowerCase().trim(); return leads.find((l) => { const n = String(l.name || "").toLowerCase().trim(); return (c && n.includes(c)) || (c && c.includes(n) && n.length > 3) || (d.client_id && l.praimyClientId === d.client_id) || (d.reference && l.fields?.refPraimy === d.reference); }); };
    const signes = new Set(leads.filter((l) => l.status === "o_yt99h").map((l) => l.id));
    let m = 0, ok = 0, cp = 0, ms = new Set(), oks = new Set(); const mprVals = {}, ceeVals = {};
    for (const d of ds) {
      const r = zp(d); if (r.cp) cp++;
      mprVals[Math.round(+(d.mpr_octroi_eur || d.mpr_amount_eur) || 0)] = (mprVals[Math.round(+(d.mpr_octroi_eur || d.mpr_amount_eur) || 0)] ?? 0) + 1;
      ceeVals[Math.round(+d.prime_cee || 0)] = (ceeVals[Math.round(+d.prime_cee || 0)] ?? 0) + 1;
      if (r.ok) ok++;
      const l = find(d); if (l) { m++; if (signes.has(l.id)) { ms.add(l.id); if (r.ok) oks.add(l.id); } }
    }
    console.log(`\n=== Essai Praimy → Zone + Profil ===\n${ds.length} dossiers | département trouvé ${cp} | zone+profil calculables ${ds.filter((d) => zp(d).ok).length} | reliés à une fiche CRM ${m}`);
    console.log(`signés de novembre reliés : ${ms.size}/${signes.size} | dont zone+profil rempli : ${oks.size}`);
    console.log(`montants MPR (valeur: nb) ${JSON.stringify(mprVals)}\nmontants CEE (valeur: nb) ${JSON.stringify(ceeVals)}`);
  }
}

// Vérification (3) : fiches où la zone + profil et les montants Praimy sont remplis (compteurs seulement).
{
  const t = (await db.collection("crm_leads").select("status", "fields").get()).docs.map((d) => d.data());
  const has = (x, k) => String(x.fields?.[k] ?? "").trim() !== "";
  const sg = t.filter((x) => x.status === "o_yt99h");
  console.log(`\n=== Remplis dans le CRM ===\nzoneProfil ${t.filter((x) => has(x, "zoneProfil")).length} | primeCee ${t.filter((x) => has(x, "primeCee")).length} | mprPraimy ${t.filter((x) => has(x, "mprPraimy")).length} | signés de novembre avec zoneProfil ${sg.filter((x) => has(x, "zoneProfil")).length}/${sg.length}`);
}
