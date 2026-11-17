// Test : envoie UNE fausse notification « nouveau lead » aux appareils de Jonas seulement
// (rien n'est créé dans le CRM, aucun mail). N'affiche que des compteurs.
import { createRequire } from "module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
initializeApp({ projectId: "kachoto-7554c" });
const db = getFirestore();
const all = await db.collection("crm_push_tokens").get();
console.log("Appareils avec notifications activées (toute l'équipe) :", all.size);
const mine = all.docs.filter((d) => d.get("email") === "jonassitbon8@gmail.com");
console.log("Appareils de Jonas :", mine.length, "| dont « nouveaux leads » coché :", mine.filter((d) => d.get("prefs")?.leads).length);
const cibles = mine.filter((d) => d.get("prefs")?.leads);
if (!cibles.length) {
  console.log("Aucun appareil de Jonas avec « nouveaux leads » activé : rien envoyé.");
  process.exit(0);
}
const res = await getMessaging().sendEach(
  cibles.map((d) => ({
    token: d.get("token"),
    data: { title: "📥 Nouveau lead : Jean TEST", body: "Reims 51100 · Site · ceci est un test, pas un vrai client", url: "/admin", tag: "test-lead" },
    webpush: { headers: { Urgency: "high" } },
  })),
);
console.log("Envoyées :", res.successCount, "| échecs :", res.failureCount, res.responses.filter((r) => !r.success).map((r) => r.error?.code).join(", "));
