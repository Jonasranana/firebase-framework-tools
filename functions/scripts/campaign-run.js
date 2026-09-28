// Lance une étape de la campagne de réactivation (voir runReactivationCampaign
// dans ../index.js) : crée un document « campaign_runs », attend que la Cloud
// Function l'ait traité et affiche le résultat. Utilisé par le workflow
// GitHub « Campagne réactivation » (déclenchement manuel uniquement).
//
// Variables : GOOGLE_APPLICATION_CREDENTIALS (compte de service), MODE
// (preview | test | send), TEST_EMAIL (mode test), MAX (mode send).
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

async function main() {
  const mode = process.env.MODE;
  if (!["preview", "test", "send"].includes(mode)) throw new Error(`MODE invalide : ${mode}`);
  initializeApp({ credential: applicationDefault(), projectId: "kachoto-7554c" });
  const db = getFirestore();
  const ref = await db.collection("campaign_runs").add({
    mode,
    testEmail: process.env.TEST_EMAIL || null,
    max: Number(process.env.MAX || 150),
    createdAt: FieldValue.serverTimestamp(),
    status: "pending",
  });
  console.log(`Étape « ${mode} » lancée (${ref.id}), en attente du résultat…`);
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    const snap = await ref.get();
    const data = snap.data();
    if (data.status === "done") {
      console.log(JSON.stringify(data.result, null, 2));
      return;
    }
    if (data.status === "error") throw new Error(data.error);
  }
  throw new Error("Pas de résultat après 10 minutes (voir les logs de runReactivationCampaign).");
}

main().catch((err) => {
  console.error(`::error::${err.message}`);
  process.exit(1);
});
