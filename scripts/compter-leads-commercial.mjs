// LECTURE SEULE : fiches attribuées à une personne (colonne « Attribué à ») encore à appeler.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const WHO = process.env.WHO || "Mebarek";

const snap = await db.collection("crm_leads").get();
const mine = snap.docs.map((d) => d.data()).filter((x) => !x.deletedAt && (x.board ?? "leads") === "leads" && x.fields?.attribue === WHO);
const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
const aAppeler = mine.filter((x) => x.status === "a_appeler");
const sansAppel = mine.filter((x) => !(x.calls ?? []).length);
console.log(`Attribuées à ${WHO} (hors corbeille) : ${mine.length}`);
console.log(`Statut « À appeler » : ${aAppeler.length}`);
console.log(`Aucun appel enregistré : ${sansAppel.length}`);
console.log(`« À appeler » ET aucun appel : ${aAppeler.filter((x) => !(x.calls ?? []).length).length}`);
console.log("Par statut : " + JSON.stringify(count(mine, (x) => x.status || "(vide)")));
console.log("« À appeler » par groupe : " + JSON.stringify(count(aAppeler, (x) => x.group || "(aucun)")));
const day = (x) => { const t = x.updatedAt?.toDate?.() ?? null; return t ? t.toISOString().slice(0, 10) : "?"; };
console.log("« À appeler » par date de dernière mise à jour : " + JSON.stringify(count(aAppeler, day)));
