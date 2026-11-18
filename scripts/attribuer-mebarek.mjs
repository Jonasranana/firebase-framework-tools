// Attribue N fiches Pac Pac jamais appelées (statut « À appeler », groupe « 0/ Contacts », non attribuées) à Mebarek
// ET les range dans le groupe « 1/ Leads Mebarek ». Les plus récentes d'abord. N'affiche que des nombres.
// Essai à blanc tant que DRY_RUN != "false".
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const N = Number(process.env.COUNT || 50);
const WHO = "Mebarek";
const TO = "mebarek";
const BY = "contact@ip5energie.com";
const dry = process.env.DRY_RUN !== "false";
initializeApp();
const db = getFirestore();

const board = await db.doc("crm_boards/leads").get();
const titles = Object.fromEntries((board.get("groups") ?? []).map((g) => [g.id, g.title]));
const title = (id) => titles[id] ?? ({ contacts: "0/ Contacts", mebarek: "1/ Leads Mebarek" }[id] ?? id);
if (!titles[TO]) console.log(`ATTENTION : groupe « ${TO} » absent de la liste des groupes du tableau.`);

const snap = await db.collection("crm_leads").get();
const ok = [];
const f = { total: 0, autreTableau: 0, corbeille: 0, autreStatut: 0, autreGroupe: 0, dejaAttribuee: 0, sansTel: 0 };
for (const d of snap.docs) {
  const x = d.data();
  f.total++;
  if ((x.board ?? "leads") !== "leads") { f.autreTableau++; continue; }
  if (x.deletedAt) { f.corbeille++; continue; }
  if ((x.status || "") !== "a_appeler") { f.autreStatut++; continue; }
  if ((x.group || "") !== "contacts") { f.autreGroupe++; continue; }
  if (x.fields?.attribue) { f.dejaAttribuee++; continue; }
  if (!String(x.phone ?? "").replace(/\D/g, "")) { f.sansTel++; continue; }
  ok.push({ id: d.id, at: x.createdAt?.toMillis?.() ?? 0 });
}
ok.sort((a, b) => b.at - a.at);
const pick = ok.slice(0, N);
const dates = pick.map((p) => new Date(p.at).toISOString().slice(0, 10)).sort();
console.log("Entonnoir :", JSON.stringify(f));
console.log(`Disponibles : ${ok.length}. Retenues : ${pick.length} (créées du ${dates[0] ?? "-"} au ${dates.at(-1) ?? "-"}).`);
console.log(`Action : Attribué à → ${WHO} + groupe « ${title("contacts")} » → « ${title(TO)} ». Mode : ${dry ? "ESSAI À BLANC" : "ÉCRITURE"}`);
if (!dry) {
  const w = db.bulkWriter();
  const at = new Date().toISOString();
  for (const p of pick) {
    w.update(db.doc(`crm_leads/${p.id}`), {
      "fields.attribue": WHO,
      group: TO,
      notes: FieldValue.arrayUnion(
        { id: Math.random().toString(36).slice(2, 12), text: `Attribué à : → ${WHO}`, by: BY, at, kind: "statut" },
        { id: Math.random().toString(36).slice(2, 12), text: `Groupe : ${title("contacts")} → ${title(TO)}`, by: BY, at, kind: "statut" },
      ),
      updatedAt: Timestamp.now(),
      updatedBy: BY,
    });
  }
  await w.close();
  console.log(`${pick.length} fiches attribuées à ${WHO} et rangées dans « ${title(TO)} ».`);
}
