// Met à jour la colonne « 🧭 Étape » des clients PRAIMY d'après l'avancement de leur dossier chez Praimy.
// - Seuls les clients PRAIMY du CRM sont concernés (Poseur = PRAIMY/Premy, ou référence/identifiant Praimy déjà enregistré,
//   ou ancien Pipeline PRAIMY). Les autres clients ne sont jamais touchés.
// - Rapprochement : référence Praimy déjà enregistrée sur la fiche, sinon nom identique (sans accents ni majuscules,
//   prénom/nom dans n'importe quel ordre) avec UNE seule fiche PRAIMY possible. Les cas douteux sont listés, jamais modifiés.
// - Praimy → CRM seulement. Chaque changement laisse une ligne dans l'historique et remet la couleur de ligne à zéro.
// Variables : GOOGLE_APPLICATION_CREDENTIALS, PRAIMY_API_KEY, DRY_RUN (1 = n'écrit rien).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const DRY = process.env.DRY_RUN !== "0";
const KEY = String(process.env.PRAIMY_API_KEY ?? "").replace(/[\r\n\s]/g, "");
if (!KEY) throw new Error("PRAIMY_API_KEY manquante");

// ── Praimy → étape (clé de l'option de la colonne Étape) ──
const ETAPES = {
  e_propal_fait: "Propal Praimy à faire", e_signature: "Devis en signature", e_mandat: "Mandat MPR à signer",
  e_audit_cours: "Audit en cours", e_vt: "Visite technique", e_pose: "Pose programmée", termine: "Terminé", bloque: "Bloqué",
};
function etapeOf(d) {
  const s = String(d.statut ?? "").toLowerCase();
  const g = String(d.global_status ?? "").toLowerCase();
  if (s === "abandonne" || g === "abandonne") return "bloque";
  if (d.is_blocked || g === "bloque") return "bloque";
  if (s === "termine") return "termine";
  if (s === "pose") return "e_pose";
  if (g === "mandat_mpr_a_signer") return "e_mandat";
  if (g === "en_audit_pre_installation" || s === "audit") return "e_audit_cours";
  if (g === "en_signature_commerciale" || s === "signature") return "e_signature";
  if (s === "visite") return "e_vt";
  if (g === "brouillon" || s === "devis") return "e_propal_fait";
  return null;
}
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");

// ── dossiers Praimy ──
const dossiers = [];
for (let page = 1; page < 30; page++) {
  const res = await fetch(`https://portail.praimy.fr/api/v1/dossiers/?size=100&page=${page}`, { headers: { "X-API-Key": KEY, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Praimy HTTP ${res.status}`);
  const d = await res.json();
  dossiers.push(...(d.items ?? []));
  if (!d.has_next) break;
}
console.log(`${DRY ? "ESSAI" : "ÉCRITURE"} — dossiers Praimy : ${dossiers.length}`);

// ── colonne Étape : s'assurer que « Audit en cours » existe ──
const colRef = db.doc("crm_boards/leads_columns");
const cfg = (await colRef.get()).get("config") ?? {};
const col = (cfg.custom ?? []).find((c) => c.key === "c_sxgefs");
if (!col) throw new Error("Colonne Étape (c_sxgefs) introuvable");
const have = new Set((col.options ?? []).map((o) => o.key));
const missing = Object.keys(ETAPES).filter((k) => !have.has(k));
if (missing.length) console.log("Options à ajouter à la colonne Étape :", missing.join(", "));
if (missing.includes("e_audit_cours") && !DRY) {
  const opts = [...col.options];
  const at = Math.max(0, opts.findIndex((o) => o.key === "e_audit"));
  opts.splice(at, 0, { key: "e_audit_cours", label: "Audit en cours", hex: "#00a2ae" });
  await colRef.set({ config: { ...cfg, custom: cfg.custom.map((c) => (c.key === "c_sxgefs" ? { ...c, options: opts } : c)) } }, { merge: true });
}

// ── clients PRAIMY du CRM ──
const snap = await db.collection("crm_leads").get();
const praimyLeads = snap.docs.filter((x) => {
  const v = x.data();
  if (v.deletedAt || (v.board || "leads") !== "leads") return false;
  const f = v.fields ?? {};
  return ["PRAIMY", "PREMY"].includes(String(f.poseur ?? "").toUpperCase()) || v.praimyClientId || f.refPraimy || ["PRAIMY", "PRAYMI"].includes(String(f.pipeline ?? "").toUpperCase());
});
console.log("clients PRAIMY dans le CRM :", praimyLeads.length);
const byRef = new Map(praimyLeads.filter((x) => x.get("fields.refPraimy")).map((x) => [String(x.get("fields.refPraimy")), x]));
const byName = new Map();
for (const x of praimyLeads) { const k = norm(x.get("name")); byName.set(k, [...(byName.get(k) ?? []), x]); }

const changes = [], same = [], doubtful = [], unmatched = [];
for (const d of dossiers) {
  const etape = etapeOf(d);
  let lead = byRef.get(String(d.reference));
  if (!lead) {
    const c = byName.get(norm(d.client_nom)) ?? [];
    if (c.length === 1) lead = c[0];
    else if (c.length > 1) { doubtful.push(`${d.client_nom} (${c.length} fiches)`); continue; }
  }
  if (!lead) { unmatched.push(d.client_nom); continue; }
  if (!etape) { doubtful.push(`${d.client_nom} (statut Praimy inconnu : ${d.statut}/${d.global_status})`); continue; }
  const cur = lead.get("fields.c_sxgefs") ?? "";
  if (cur === etape && lead.get("fields.refPraimy") === d.reference) { same.push(lead.id); continue; }
  changes.push({ ref: lead.ref, name: lead.get("name"), from: cur, to: etape, reference: d.reference, dossier: d.client_nom });
}
const lbl = (k) => ETAPES[k] ?? (k ? k : "vide");
console.log(`déjà à jour : ${same.length} · à modifier : ${changes.length} · douteux : ${doubtful.length} · sans fiche PRAIMY dans le CRM : ${unmatched.length}`);
for (const c of changes) console.log(` • ${c.name} (dossier « ${c.dossier} », réf ${c.reference}) : ${lbl(c.from)} → ${lbl(c.to)}`);
if (doubtful.length) console.log("douteux (non modifiés) :", doubtful.join(" | "));
if (unmatched.length) console.log("dossiers Praimy sans fiche PRAIMY correspondante :", unmatched.join(" | "));

if (!DRY && changes.length) {
  for (const c of changes) {
    const patch = { "fields.refPraimy": c.reference, updatedBy: "praimy" };
    if (c.from !== c.to) {
      patch["fields.c_sxgefs"] = c.to;
      patch.statusChangedAt = FieldValue.serverTimestamp();
      patch.updatedAt = FieldValue.serverTimestamp();
      patch.notes = FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 12), text: `Étape : ${lbl(c.from)} → ${lbl(c.to)} (Praimy)`, by: "Praimy", at: new Date().toISOString(), kind: "statut" });
    }
    await c.ref.update(patch);
  }
  console.log("Fait :", changes.length);
}
if (!DRY) await db.doc("praimy_sync_state/main").set({ lastRun: FieldValue.serverTimestamp(), dossiers: dossiers.length, changed: changes.length, doubtful: doubtful.length, unmatched: unmatched.length }, { merge: true });
