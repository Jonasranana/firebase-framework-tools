// Vérifie que l'archive Monday est COMPLÈTE : compare chaque tableau de Monday (tous types, tous états)
// avec ce qui est copié dans le CRM. Ne modifie rien, ni dans Monday ni dans le CRM.
//   - tableau absent de l'archive
//   - copie non terminée
//   - moins de lignes copiées que dans Monday
//   - fichiers en erreur ou sans lien (lecture des fichiers de chaque ligne)
// Les tableaux « supprimés » dans Monday ne sont plus lisibles par l'API : ils sont comptés à part.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const token = process.env.MONDAY_API_TOKEN;
if (!token) throw new Error("MONDAY_API_TOKEN manquant");
initializeApp();
const db = getFirestore();

async function monday(query, variables, version = "2024-10") {
  for (let a = 1; ; a++) {
    const res = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json", "API-Version": version },
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && !body.errors?.length) return body.data;
    const text = JSON.stringify(body);
    if (/Unknown argument|Invalid version|API version/i.test(text) || a >= 6) throw new Error(`API Monday: ${text.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 3000 * a));
  }
}

let API = "2026-01";
for (const v of ["2026-07", "2026-04", "2026-01", "2025-10"]) {
  try {
    await monday(`query { boards(limit: 1, hierarchy_types: [classic, multi_level]) { id } }`, {}, v);
    API = v;
    break;
  } catch {}
}

const boards = [];
for (let page = 1; ; page++) {
  const d = await monday(
    `query ($page: Int) { boards(limit: 100, page: $page, state: all, order_by: created_at, hierarchy_types: [classic, multi_level]) { id name state items_count workspace { name } } }`,
    { page },
    API,
  );
  if (!d.boards.length) break;
  boards.push(...d.boards);
}
const deleted = boards.filter((b) => b.state === "deleted");
const readable = boards.filter((b) => b.state !== "deleted");

const archived = new Map((await db.collection("monday_boards").get()).docs.map((d) => [d.id, d.data()]));
const problems = [];
let totalMonday = 0;
let totalCopied = 0;
let filesBad = 0;
let filesOk = 0;
for (const b of readable) {
  const a = archived.get(b.id);
  const expected = Number(b.items_count ?? 0);
  totalMonday += expected;
  if (!a) {
    if (expected > 0) problems.push(`ABSENT       ${b.name} (${expected} lignes) [${b.state}] id=${b.id}`);
    continue;
  }
  if (a.complete !== true) problems.push(`NON TERMINÉ  ${b.name} id=${b.id}`);
  const cnt = (await db.collection("monday_items").where("boardId", "==", b.id).count().get()).data().count;
  totalCopied += cnt;
  if (cnt < expected) problems.push(`INCOMPLET    ${b.name} : ${cnt} copiées sur ${expected} dans Monday id=${b.id}`);
  if ((a.filesCount ?? 0) > 0) {
    const snap = await db.collection("monday_items").where("boardId", "==", b.id).select("files").get();
    for (const d of snap.docs) {
      for (const f of d.get("files") ?? []) {
        if (f.url) filesOk++;
        else {
          filesBad++;
          problems.push(`FICHIER KO   ${b.name} / ${f.name} : ${f.error || f.skipped || "sans lien"} id=${b.id}`);
        }
      }
    }
  }
}
console.log("──────── VÉRIFICATION DE L'ARCHIVE MONDAY ────────");
console.log(`Version d'API : ${API}`);
console.log(`Tableaux dans Monday (lisibles) : ${readable.length} — supprimés dans Monday (corbeille, illisibles) : ${deleted.length}`);
console.log(`Lignes dans Monday : ${totalMonday} — lignes copiées : ${totalCopied}`);
console.log(`Fichiers copiés avec lien : ${filesOk} — en erreur : ${filesBad}`);
if (!problems.length) console.log("RÉSULTAT : OK, aucun écart.");
else {
  console.log(`RÉSULTAT : ${problems.length} ÉCART(S) :`);
  for (const p of problems) console.log("  - " + p);
}
