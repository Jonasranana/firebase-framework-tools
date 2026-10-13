// Reprise des FICHIERS du tableau Monday « Pac Pac😀 » (colonne « 📄 Documents »)
// dans le stockage du CRM : chaque fichier est copié dans Firebase Storage
// (crm/leads/<id>/…) et indexé dans crm_documents, rattaché à la fiche
// « monday_<id Monday> » créée par l'import des leads.
//
// À lancer APRÈS l'import des leads (les fiches doivent exister).
// - Relançable : un fichier déjà copié (id monday_<id du fichier>) est sauté.
// - Jamais d'écrasement, aucune suppression côté Monday.
// - DRY_RUN=1 : compte seulement les fichiers et le volume total.
// - S'arrête proprement après ~5 h 30 (limite GitHub) : relancer pour continuer.
//
// Variables : GOOGLE_APPLICATION_CREDENTIALS, MONDAY_API_TOKEN, DRY_RUN.

import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const BOARD_ID = "18410104402";
const FILE_COLUMN = "file_mm2qa52t";
const BUCKET = "kachoto-7554c.firebasestorage.app";
const DRY_RUN = process.env.DRY_RUN === "1";
const MAX_BYTES = 100 * 1024 * 1024;
const DEADLINE = Date.now() + 5.5 * 3600 * 1000;
const token = process.env.MONDAY_API_TOKEN;
if (!token) {
  console.error("MONDAY_API_TOKEN manquant");
  process.exit(1);
}
initializeApp({ storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

const MIME = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  zip: "application/zip",
};

const guessCategory = (fileName) => {
  const n = fileName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/avis|impot|imposition|revenu|dgfip/.test(n)) return "Avis d'imposition";
  if (/identite|cni|passeport|carte.?id|permis/.test(n)) return "Pièce d'identité";
  if (/facture|edf|engie|totalenergies|energie|gaz|fioul|electricite/.test(n)) return "Facture énergie";
  if (/taxe.?fonciere|propriete|acte|titre/.test(n)) return "Taxe foncière / titre de propriété";
  if (/devis|contrat|bon.?de.?commande|propal/.test(n)) return "Devis / contrat";
  if (/mpr|maprimerenov|cee|c2e|attestation|cadre.?de.?contribution/.test(n)) return "Dossier CEE / MaPrimeRénov'";
  if (/assurance|decennale|rge|qualipac|kbis|urssaf/.test(n)) return "Assurance / RGE";
  if (/\.(jpe?g|png|heic|webp)$/.test(n) || /photo|img_|dsc/.test(n)) return "Photos du chantier";
  return "Autre";
};

async function monday(query, variables) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json", "API-Version": "2024-10" },
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && !body.errors?.length) return body.data;
    if (attempt >= 5) throw new Error(`API Monday: ${JSON.stringify(body)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

// Seules les pages d'éléments qui ont des fichiers nous intéressent : on lit
// tout le tableau mais on ne garde que les éléments avec au moins un fichier.
const QUERY = `query ($board: ID!, $cursor: String) {
  boards(ids: [$board]) {
    items_page(limit: 50, cursor: $cursor) {
      cursor
      items {
        id name
        assets(column_ids: ["${FILE_COLUMN}"]) { id name public_url file_extension file_size created_at }
      }
    }
  }
}`;

const leadIds = new Set((await db.collection("crm_leads").select().get()).docs.map((d) => d.id));
console.log(`${leadIds.size} fiches leads dans le CRM.`);

const stats = { elements_avec_fichiers: 0, fichiers: 0, octets: 0, copies: 0, deja_la: 0, sans_fiche: 0, trop_gros: 0, erreurs: 0 };

async function copyAsset(item, a) {
  const docId = `monday_${a.id}`;
  if ((await db.doc(`crm_documents/${docId}`).get()).exists) {
    stats.deja_la++;
    return;
  }
  if (!a.public_url) throw new Error("pas d'URL publique");
  const res = await fetch(a.public_url);
  if (!res.ok) throw new Error(`téléchargement refusé (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = String(a.file_extension ?? "").replace(".", "").toLowerCase();
  const name = a.name || `fichier-${a.id}${ext ? "." + ext : ""}`;
  const safe = name.replace(/[^\w.\- ()àâäçéèêëîïôöùûüÿ]/gi, "_").slice(0, 120);
  const path = `crm/leads/monday_${item.id}/${Date.now()}_${a.id}_${safe}`;
  const dl = randomUUID();
  const contentType = MIME[ext] ?? "application/octet-stream";
  await bucket.file(path).save(buf, { contentType, metadata: { metadata: { firebaseStorageDownloadTokens: dl } } });
  await db.doc(`crm_documents/${docId}`).set({
    ownerType: "lead",
    ownerId: `monday_${item.id}`,
    ownerName: item.name,
    name,
    category: guessCategory(name),
    size: buf.length,
    contentType,
    path,
    url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${dl}`,
    source: "monday",
    uploadedBy: "import Monday",
    createdAt: a.created_at ? Timestamp.fromDate(new Date(a.created_at)) : Timestamp.now(),
  });
  stats.copies++;
}

let cursor = null;
let stopped = false;
do {
  const data = await monday(QUERY, { board: BOARD_ID, cursor });
  const page = data.boards[0].items_page;
  for (const item of page.items) {
    if (!item.assets?.length) continue;
    stats.elements_avec_fichiers++;
    const owner = `monday_${item.id}`;
    const touched = new Set();
    for (const a of item.assets) {
      stats.fichiers++;
      stats.octets += Number(a.file_size ?? 0);
      if (!leadIds.has(owner)) {
        stats.sans_fiche++;
        continue;
      }
      if (Number(a.file_size ?? 0) > MAX_BYTES) {
        stats.trop_gros++;
        continue;
      }
      if (DRY_RUN) continue;
      if (Date.now() > DEADLINE) {
        stopped = true;
        break;
      }
      try {
        await copyAsset(item, a);
        touched.add(owner);
      } catch (e) {
        stats.erreurs++;
        console.error(`ÉCHEC ${item.name} / ${a.name}: ${e.message}`);
      }
    }
    // Met à jour le compteur de documents de la fiche (colonne « Docs »).
    if (!DRY_RUN && touched.size) {
      const docs = await db.collection("crm_documents").where("ownerId", "==", owner).get();
      await db.doc(`crm_leads/${owner}`).update({
        docCount: docs.size,
        docCats: Array.from(new Set(docs.docs.map((d) => d.get("category")))),
      });
    }
    if (stopped) break;
  }
  if (stats.fichiers && stats.fichiers % 200 < 50) console.log("…", JSON.stringify(stats));
  cursor = stopped ? null : page.cursor;
} while (cursor);

console.log(DRY_RUN ? "ESSAI À BLANC (rien d'écrit)" : stopped ? "ARRÊT (temps écoulé) : relancer pour continuer" : "REPRISE TERMINÉE");
console.log({ ...stats, volume_Go: +(stats.octets / 1e9).toFixed(2) });
if (stats.erreurs > 0) process.exit(1);
