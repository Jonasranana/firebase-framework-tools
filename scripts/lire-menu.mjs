import { createRequire } from "module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "kachoto-7554c" });
const db = admin.firestore();
const s = await db.doc("crm_boards/sidebar").get();
const c = s.data()?.config ?? s.data();
for (const f of c?.folders ?? []) {
  console.log(`DOSSIER ${f.id} « ${f.title} »`);
  for (const i of f.items ?? []) console.log(`   ${i.id} | ${i.kind} | ${i.page} | « ${i.title} »${i.board ? " | board=" + i.board : ""}${i.archived ? " | ARCHIVÉ" : ""}${i.deletedAt ? " | SUPPRIMÉ" : ""}`);
}
console.log("favoris", JSON.stringify(c?.favorites), "ws", c?.workspaceName, "clés", Object.keys(s.data() ?? {}));
const boards = new Map();
(await db.collection("crm_leads").select("board").get()).forEach((d) => { const b = d.get("board") || "leads"; boards.set(b, (boards.get(b) || 0) + 1); });
console.log("leads par tableau", JSON.stringify([...boards]));
