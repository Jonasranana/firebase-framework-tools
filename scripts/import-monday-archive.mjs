// Archive COMPLÈTE de Monday dans le CRM (lecture seule côté Monday) :
// tous les tableaux (actifs, archivés, sous-éléments), avec pour chaque ligne
// toutes les colonnes (texte affiché + valeur brute), le groupe, les
// étiquettes (réglages des colonnes), les commentaires (« mises à jour » et
// leurs réponses) et TOUS les fichiers (copiés dans Firebase Storage).
//
// Firestore :
//   monday_boards/<id>   tableau : colonnes (+ réglages/étiquettes), groupes…
//   monday_items/<b>_<i> ligne : colonnes, fichiers, mots-clés de recherche
//   monday_updates/<id>  commentaire d'une ligne (+ réponses, + pièces jointes)
//   monday_meta/users    id Monday → nom / e-mail (colonnes « Personnes »)
//   monday_archive_state/main  avancement (reprise automatique)
// Storage : crm/monday/<tableau>/<ligne>/<id fichier>_<nom>
//
// - Relançable à volonté : une ligne déjà complète est sautée, un fichier déjà
//   copié n'est jamais retéléchargé. Aucune suppression nulle part.
// - DRY_RUN=1 : compte tableaux / lignes / fichiers / volume, n'écrit rien.
// - S'arrête proprement après ~5 h 30 : le workflow reprend tout seul.
// - Codes de sortie : 0 = terminé, 3 = temps écoulé (à reprendre), 1 = erreur.
//
// Variables : GOOGLE_APPLICATION_CREDENTIALS, MONDAY_API_TOKEN, DRY_RUN,
// FILES (0 pour ignorer les fichiers), BOARD_IDS (liste facultative).

import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const BUCKET = "kachoto-7554c.firebasestorage.app";
const DRY_RUN = process.env.DRY_RUN === "1";
const WITH_FILES = process.env.FILES !== "0";
const ONLY = (process.env.BOARD_IDS ?? "").split(/[,\s]+/).filter(Boolean);
const MAX_BYTES = 200 * 1024 * 1024;
const DEADLINE = Date.now() + 5.5 * 3600 * 1000;
const token = process.env.MONDAY_API_TOKEN;
if (!token) {
  console.error("MONDAY_API_TOKEN manquant");
  process.exit(1);
}
initializeApp({ storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

// Lancement planifié : ne reprend que si une archive a été démarrée à la main et n'est pas finie.
if (process.env.SCHEDULED === "1") {
  const st = await db.doc("monday_archive_state/main").get();
  if (!st.exists || st.get("enabled") !== true || st.get("done") === true) {
    console.log("Rien à reprendre (archive non démarrée ou terminée).");
    process.exit(0);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class ComplexityError extends Error {}

// Version d'API : 2024-10 par défaut ; les tableaux « multi-niveaux » (ex. « Tableau pour Depot ») ne sont
// visibles qu'avec une version récente et le paramètre hierarchy_types.
const API_NEW = "2025-07";
async function monday(query, variables, version = "2024-10") {
  for (let attempt = 1; ; attempt++) {
    let body = {};
    let res;
    try {
      res = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json", "API-Version": version },
        body: JSON.stringify({ query, variables }),
      });
      body = await res.json().catch(() => ({}));
    } catch (e) {
      body = { errors: [{ message: String(e) }] };
    }
    if (res?.ok && !body.errors?.length) return body.data;
    const text = JSON.stringify(body);
    if (/omplexity/i.test(text) && !/reset|budget/i.test(text)) throw new ComplexityError(text.slice(0, 300));
    if (attempt >= 8) throw new Error(`API Monday: ${text.slice(0, 500)}`);
    // Limite de débit : on attend (parfois jusqu'à une minute) puis on réessaie.
    const wait = /budget|rate|429|limit/i.test(text) ? 20000 * attempt : 2000 * attempt;
    await sleep(wait);
  }
}

const MIME = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  heic: "image/heic", doc: "application/msword", txt: "text/plain", zip: "application/zip", mp4: "video/mp4", mov: "video/quicktime",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv",
};

const stats = { tableaux: 0, tableaux_vides_ou_illisibles: 0, lignes: 0, lignes_sautees: 0, commentaires: 0, fichiers: 0, octets: 0, copies: 0, deja_la: 0, trop_gros: 0, erreurs: 0 };

// ── Utilisateurs ───────────────────────────────────────────────────────────
const usersData = await monday(`query { users(limit: 500) { id name email title } }`);
const users = Object.fromEntries(usersData.users.map((u) => [u.id, { name: u.name, email: u.email }]));
if (!DRY_RUN) await db.doc("monday_meta/users").set({ users, at: Timestamp.now() });

// ── Tableaux ───────────────────────────────────────────────────────────────
const boards = [];
for (let page = 1; ; page++) {
  const d = await monday(
    `query ($page: Int) { boards(limit: 100, page: $page, state: all, order_by: created_at, hierarchy_types: [classic, multi_level]) {
      id name state board_kind description workspace { id name } board_folder_id items_count
      columns { id title type settings_str archived } groups { id title color archived position }
    } }`,
    { page },
    API_NEW,
  );
  if (!d.boards.length) break;
  boards.push(...d.boards);
}
let folderNames = {};
try {
  const f = await monday(`query { folders(limit: 100) { id name } }`);
  folderNames = Object.fromEntries(f.folders.map((x) => [x.id, x.name]));
} catch {}
// Les tableaux « supprimés » (corbeille Monday) ne sont plus lisibles par l'API : on les met de côté.
const deletedBoards = boards.filter((b) => b.state === "deleted");
const selected = boards.filter((b) => (!ONLY.length || ONLY.includes(b.id)) && (b.state !== "deleted" || ONLY.includes(b.id)));
console.log(`${deletedBoards.length} tableaux supprimés dans Monday (illisibles, ignorés).`);
console.log(`${boards.length} tableaux trouvés (${selected.length} à traiter).`);

const ITEM_BODY = `
  id name state created_at updated_at creator_id group { id title } parent_item { id }
  column_values { id type text value
    ... on MirrorValue { display_value }
    ... on BoardRelationValue { display_value linked_item_ids }
    ... on FormulaValue { display_value }
    ... on DependencyValue { display_value } }
  assets { id name public_url file_extension file_size created_at uploaded_by { id name } }
  updates(limit: 100) { id text_body body created_at updated_at creator { id name email }
    assets { id name public_url file_extension file_size created_at }
    replies { id text_body body created_at creator { id name email } } }`;

// Les pages de lignes : la taille est fixée à la première requête (liée au curseur).
// Si Monday refuse pour « complexité », on recommence le tableau avec des pages plus petites.
async function* itemsOf(boardId) {
  let limit = 20;
  for (;;) {
    try {
      const first = await monday(
        `query ($board: ID!) { boards(ids: [$board], state: all, hierarchy_types: [classic, multi_level]) { items_page(limit: ${limit}) { cursor items { ${ITEM_BODY} } } } }`,
        { board: boardId },
        API_NEW,
      );
      let page = first.boards[0]?.items_page;
      while (page) {
        yield* page.items;
        if (!page.cursor) return;
        const nx = await monday(
          `query ($cursor: String!) { next_items_page(limit: ${limit}, cursor: $cursor) { cursor items { ${ITEM_BODY} } } }`,
          { cursor: page.cursor },
          API_NEW,
        );
        page = nx.next_items_page;
      }
      return;
    } catch (e) {
      if (e instanceof ComplexityError && limit > 2) {
        limit = Math.max(2, Math.floor(limit / 2));
        console.warn(`  complexité trop élevée : pages de ${limit} lignes`);
        continue;
      }
      throw e;
    }
  }
}

// Commentaires au-delà de 100 sur une ligne.
async function moreUpdates(itemId, have) {
  const all = [...have];
  for (let page = 2; have.length >= 100; page++) {
    const d = await monday(
      `query ($id: [ID!], $page: Int) { items(ids: $id) { updates(limit: 100, page: $page) { id text_body body created_at updated_at creator { id name email }
        assets { id name public_url file_extension file_size created_at } replies { id text_body body created_at creator { id name email } } } } }`,
      { id: [itemId], page },
    );
    const u = d.items[0]?.updates ?? [];
    all.push(...u);
    if (u.length < 100) break;
  }
  return all;
}

const safeName = (n) => String(n).replace(/[^\w.\- ()àâäçéèêëîïôöùûüÿ]/gi, "_").slice(0, 120);

async function copyFile(boardId, itemId, a) {
  const ext = String(a.file_extension ?? "").replace(".", "").toLowerCase();
  const name = a.name || `fichier-${a.id}${ext ? "." + ext : ""}`;
  const path = `crm/monday/${boardId}/${itemId}/${a.id}_${safeName(name)}`;
  const base = { id: String(a.id), name, ext, size: Number(a.file_size ?? 0), path, createdAt: a.created_at ?? "", uploadedBy: a.uploaded_by?.name ?? "" };
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (exists) {
    stats.deja_la++;
    const [meta] = await file.getMetadata();
    const tok = meta.metadata?.firebaseStorageDownloadTokens;
    if (tok) return { ...base, url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${tok}` };
  }
  if (base.size > MAX_BYTES) {
    stats.trop_gros++;
    return { ...base, skipped: "trop gros (> 200 Mo)" };
  }
  if (!a.public_url) throw new Error("pas d'URL publique");
  const res = await fetch(a.public_url);
  if (!res.ok) throw new Error(`téléchargement refusé (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tok = randomUUID();
  await file.save(buf, { contentType: MIME[ext] ?? "application/octet-stream", metadata: { metadata: { firebaseStorageDownloadTokens: tok } } });
  stats.copies++;
  return { ...base, size: buf.length, url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${tok}` };
}

async function mapLimit(list, n, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, list.length) }, async () => {
      while (i < list.length) {
        const k = i++;
        out[k] = await fn(list[k]);
      }
    }),
  );
  return out;
}

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function keysOf(name, cols) {
  const k = new Set();
  norm(name).split(/[^a-z0-9]+/).filter((t) => t.length >= 3).slice(0, 8).forEach((t) => k.add(t));
  for (const c of cols) {
    const t = c.text ?? "";
    if (!t) continue;
    for (const m of t.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) k.add(m[0].toLowerCase());
    if (c.type === "phone" || c.type === "text") {
      const d = t.replace(/\D/g, "");
      if (c.type === "phone" && d.length >= 9) k.add("tel" + d.slice(-9));
    }
  }
  return Array.from(k).slice(0, 40);
}

async function doBoard(b) {
  const boardRef = db.doc(`monday_boards/${b.id}`);
  const prev = DRY_RUN ? null : await boardRef.get();
  if (prev?.exists && prev.get("complete") === true) {
    console.log(`= ${b.name} : déjà archivé.`);
    return "done";
  }
  const own = { items: 0, files: 0, bytes: 0 };
  let ok = false;
  try {
    if (!DRY_RUN)
      await boardRef.set({
        id: b.id, name: b.name, state: b.state, kind: b.board_kind, description: b.description ?? "",
        workspace: b.workspace?.name ?? "", folder: folderNames[b.board_folder_id] ?? "", folderId: b.board_folder_id ?? "",
        itemsCount: b.items_count ?? 0, columns: b.columns, groups: b.groups ?? [], complete: false, startedAt: Timestamp.now(),
      });
    const fileColumns = new Set(b.columns.filter((c) => c.type === "file").map((c) => c.id));
    for await (const item of itemsOf(b.id)) {
      if (Date.now() > DEADLINE) return "timeout";
      own.items++;
      stats.lignes++;
      const files = item.assets ?? [];
      const updates = item.updates.length >= 100 ? await moreUpdates(item.id, item.updates) : item.updates;
      const updFiles = updates.flatMap((u) => u.assets ?? []);
      for (const f of [...files, ...updFiles]) {
        own.files++;
        stats.fichiers++;
        own.bytes += Number(f.file_size ?? 0);
        stats.octets += Number(f.file_size ?? 0);
      }
      stats.commentaires += updates.length;
      if (DRY_RUN) continue;

      const docId = `${b.id}_${item.id}`;
      const itemRef = db.doc(`monday_items/${docId}`);
      const existing = await itemRef.get();
      if (existing.exists && existing.get("complete") === true) {
        stats.lignes_sautees++;
        continue;
      }

      // Colonne d'origine de chaque fichier (d'après la valeur brute des colonnes « fichier »).
      const colOfAsset = {};
      for (const cv of item.column_values) {
        if (!fileColumns.has(cv.id) || !cv.value) continue;
        try {
          for (const f of JSON.parse(cv.value).files ?? []) if (f.assetId) colOfAsset[String(f.assetId)] = cv.id;
        } catch {}
      }
      let copied = [];
      if (WITH_FILES && files.length) {
        copied = await mapLimit(files, 4, async (a) => {
          try {
            return { ...(await copyFile(b.id, item.id, a)), col: colOfAsset[String(a.id)] ?? "" };
          } catch (e) {
            stats.erreurs++;
            console.error(`ÉCHEC fichier ${item.name} / ${a.name}: ${e.message}`);
            return { id: String(a.id), name: a.name ?? "", size: Number(a.file_size ?? 0), col: colOfAsset[String(a.id)] ?? "", error: e.message };
          }
        });
      }

      // Colonnes : seulement celles qui ont une valeur (texte, valeur brute, valeur calculée).
      const cols = {};
      for (const cv of item.column_values) {
        const display = cv.display_value ?? "";
        if (!cv.text && !cv.value && !display) continue;
        const o = { type: cv.type };
        if (cv.text) o.t = cv.text;
        if (display && display !== cv.text) o.d = display;
        if (cv.value) o.v = cv.value;
        if (cv.linked_item_ids?.length) o.l = cv.linked_item_ids;
        cols[cv.id] = o;
      }

      const upd = [];
      for (const u of updates) {
        let ufiles = [];
        if (WITH_FILES && u.assets?.length) {
          ufiles = await mapLimit(u.assets, 3, async (a) => {
            try {
              return await copyFile(b.id, item.id, a);
            } catch (e) {
              stats.erreurs++;
              return { id: String(a.id), name: a.name ?? "", error: e.message };
            }
          });
        }
        upd.push(
          db.doc(`monday_updates/${u.id}`).set({
            itemKey: docId, boardId: b.id, itemId: item.id, text: u.text_body ?? "", html: u.body ?? "",
            author: u.creator?.name ?? "", authorEmail: u.creator?.email ?? "", at: u.created_at ?? "", files: ufiles,
            replies: (u.replies ?? []).map((r) => ({ id: r.id, text: r.text_body ?? "", author: r.creator?.name ?? "", at: r.created_at ?? "" })),
          }),
        );
      }
      await Promise.all(upd);

      const s = norm([item.name, ...Object.values(cols).map((c) => c.t ?? c.d ?? "")].join(" ")).slice(0, 3000);
      await itemRef.set({
        boardId: b.id, boardName: b.name, itemId: item.id, name: item.name, state: item.state ?? "active",
        groupId: item.group?.id ?? "", groupTitle: item.group?.title ?? "", parentItemId: item.parent_item?.id ?? "",
        createdAt: item.created_at ?? "", updatedAt: item.updated_at ?? "", creator: users[item.creator_id]?.name ?? "",
        cols, files: copied, updatesCount: updates.length, s, keys: keysOf(item.name, item.column_values),
        complete: true, archivedAt: Timestamp.now(),
      });
    }
    ok = true;
  } finally {
    if (!DRY_RUN && ok) await boardRef.update({ complete: true, itemsArchived: own.items, filesCount: own.files, finishedAt: Timestamp.now() });
  }
  stats.tableaux++;
  console.log(`✔ ${b.state.padEnd(8)} ${String(own.items).padStart(5)} lignes, ${String(own.files).padStart(5)} fichiers (${(own.bytes / 1e6).toFixed(0)} Mo) — ${b.name}`);
  return "done";
}

let timedOut = false;
for (const b of selected) {
  try {
    const r = await doBoard(b);
    if (r === "timeout") {
      timedOut = true;
      break;
    }
  } catch (e) {
    stats.tableaux_vides_ou_illisibles++;
    console.error(`✘ ${b.name} (${b.state}, ${b.id}) : ${String(e.message).slice(0, 200)}`);
  }
}

if (!DRY_RUN) {
  await db.doc("monday_archive_state/main").set(
    { enabled: true, done: !timedOut, lastRun: Timestamp.now(), stats },
    { merge: true },
  );
}
console.log(DRY_RUN ? "ESSAI À BLANC (rien d'écrit)" : timedOut ? "ARRÊT (temps écoulé) : reprise automatique" : "PASSAGE TERMINÉ");
console.log({ ...stats, volume_Go: +(stats.octets / 1e9).toFixed(2) });
process.exit(timedOut ? 3 : stats.erreurs > 0 || stats.tableaux_vides_ou_illisibles > 0 ? 1 : 0);
