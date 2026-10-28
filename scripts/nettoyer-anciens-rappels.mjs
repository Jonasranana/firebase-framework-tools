// Retire les rappels (colonne « 🔔 Rappel ») dont la date est AVANT le lundi de cette semaine.
// Demandé par Jonas. Rien d'autre n'est changé ; chaque fiche garde une ligne d'historique
// « Rappel supprimé (ancien rappel du JJ/MM HH:MM) » pour ne pas perdre l'information.
// Essai à blanc par défaut (DRY_RUN != "false" n'écrit rien).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const dry = process.env.DRY_RUN !== "false";
const BY = "nettoyage des anciens rappels";

const today = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
const d = new Date(`${today}T12:00:00Z`);
d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
const MONDAY = process.env.MONDAY || d.toISOString().slice(0, 10);
console.log(`Aujourd'hui ${today} · on retire les rappels datés avant le lundi ${MONDAY}.`);

const snap = await db.collection("crm_leads").get();
const todo = [];
let kept = 0;
for (const doc of snap.docs) {
  const x = doc.data();
  if (x.deletedAt) continue;
  const r = String(x.rappelLe ?? "").slice(0, 10);
  if (!r) continue;
  if (r >= MONDAY) { kept++; continue; }
  todo.push({ doc, x, r });
}
console.log(`À retirer : ${todo.length} · gardés (cette semaine ou plus tard) : ${kept}`);
const byWeek = new Map();
for (const t of todo) { const k = t.r.slice(0, 7); byWeek.set(k, (byWeek.get(k) ?? 0) + 1); }
console.log("Par mois : " + [...byWeek].sort().map(([k, n]) => `${k}: ${n}`).join(" · "));
for (const t of todo.sort((a, b) => b.r.localeCompare(a.r)).slice(0, 40)) console.log(`- ${t.x.name} | rappel ${t.r} ${t.x.fields?.rappelHeure ?? ""} | statut ${t.x.status}`);
if (todo.length > 40) console.log(`… et ${todo.length - 40} autres`);
if (dry) { console.log("ESSAI À BLANC : rien n'est écrit."); process.exit(0); }

const at = new Date().toISOString();
let n = 0;
for (const t of todo) {
  const [y, m, j] = t.r.split("-");
  const h = t.x.fields?.rappelHeure ? ` ${t.x.fields.rappelHeure}` : "";
  await t.doc.ref.update({
    rappelLe: "",
    "fields.rappelHeure": "",
    notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 9), kind: "statut", text: `🔔 Rappel supprimé (ancien rappel du ${j}/${m}/${y}${h})`, by: BY, at }),
  });
  n++;
}
console.log(`ÉCRIT : ${n} rappels retirés.`);
