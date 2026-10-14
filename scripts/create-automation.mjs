// Crée une automatisation du CRM (crm_automations) à partir d'un JSON : sert quand on la
// décrit à Claude sur l'ordinateur. Vérifie le contenu avant d'écrire ; l'automatisation est
// créée ACTIVE seulement si "enabled" est vrai (sinon désactivée, à activer dans ⚡ Automatiser).
// Variables : AUTOMATION_JSON, GOOGLE_APPLICATION_CREDENTIALS.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const ACTION_TYPES = ["notify_team", "send_template", "send_email", "send_sms", "move_group", "set_column", "set_date", "add_note"];
const a = JSON.parse(process.env.AUTOMATION_JSON ?? "{}");
if (!a.name || !a.trigger || !Array.isArray(a.actions) || !a.actions.length) throw new Error("name, trigger et actions sont requis");
if (!["created", "column_changes"].includes(a.trigger.type)) throw new Error("trigger.type invalide");
if (a.trigger.type === "column_changes" && !a.trigger.col) throw new Error("trigger.col requis");
for (const x of a.actions) if (!ACTION_TYPES.includes(x.type)) throw new Error(`action inconnue : ${x.type}`);

initializeApp();
const db = getFirestore();
const ref = await db.collection("crm_automations").add({
  name: String(a.name).slice(0, 120),
  enabled: a.enabled === true,
  trigger: a.trigger,
  actions: a.actions,
  runs: 0,
  createdBy: "Claude (ordinateur)",
  createdAt: FieldValue.serverTimestamp(),
});
console.log(`Automatisation créée : ${ref.id} (${a.enabled === true ? "ACTIVE" : "désactivée"})`);
