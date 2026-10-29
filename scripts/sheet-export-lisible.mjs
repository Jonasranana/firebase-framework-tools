// Ajoute à un Google Sheet d'export du CRM un onglet « 📋 Lisible » (en première position) avec des colonnes
// claires et un historique propre (une ligne par événement, du plus récent au plus ancien, sans traces techniques).
// L'onglet d'origine n'est JAMAIS modifié. Les données viennent du CRM (fiche retrouvée par téléphone, corbeille
// comprise) ; à défaut, de la ligne du Sheet. Essai à blanc par défaut (DRY_RUN != "false" n'écrit rien).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { google } = require("googleapis");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const dry = process.env.DRY_RUN !== "false";
const SHEET_ID = process.env.SHEET_ID || "1ek-Pjxqowqa3YA0wwd-ILsfbw0HTYCUMtrpo36pGeQk";
const TAB = "📋 Lisible";

const base = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const sec = await google.secretmanager({ version: "v1", auth: base }).projects.secrets.versions.access({ name: "projects/kachoto-7554c/secrets/DRIVE_SA_KEY/versions/latest" });
const key = JSON.parse(Buffer.from(sec.data.payload.data, "base64").toString("utf8"));
const sheets = google.sheets({ version: "v4", auth: new google.auth.GoogleAuth({ credentials: key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] }) });

// Noms lisibles
const STATUTS = Object.fromEntries(
  ((await db.doc("crm_boards/leads_columns").get()).data()?.config?.options?.status ?? []).map((o) => [o.key, o.label]),
);
const WHO = { "mebarouk2012@gmail.com": "Mebarek", "alexis.sitbon@gmail.com": "Alexis", "carol.sitbon05@gmail.com": "Carole", "jonassitbon8@gmail.com": "Jonas", "contact@ip5energie.com": "IP5" };
const who = (by) => WHO[String(by ?? "").toLowerCase()] ?? String(by ?? "").split("@")[0];
const TECH = /^(Groupe\b|Fiche archivée|Rangement|Restauration|🔔 Rappel supprimé|Attribué à|Importé depuis Monday|Fiche ressortie)/i;
const clean = (t) => String(t ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
const ddmm = (iso) => { const [y, m, d] = String(iso ?? "").slice(0, 10).split("-"); return d ? `${d}/${m}/${y}` : ""; };
const digits = (p) => { let d = String(p ?? "").replace(/\D/g, ""); if (d.startsWith("33") && d.length === 11) d = "0" + d.slice(2); return d; };
const tsIso = (v) => (v?.toDate ? v.toDate().toISOString() : typeof v === "string" ? v : "");

// Fiches du CRM indexées par téléphone (corbeille comprise)
const byPhone = new Map();
for (const d of (await db.collection("crm_leads").get()).docs) {
  const x = d.data();
  const k = digits(x.phone);
  if (k) byPhone.set(k, x);
}

// Lecture de l'onglet d'origine (jamais l'onglet « Lisible » lui-même).
const tabs = (await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets(properties(title))" })).data.sheets.map((x) => x.properties.title);
const ORIG = tabs.find((t) => t !== TAB);
console.log(`Onglet d'origine lu : « ${ORIG} »`);
const src = (await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${ORIG}'!A1:L5000` })).data.values ?? [];
const [, ...rows] = src;
const out = [["Nom", "Téléphone", "Statut", "Département / ville", "Email", "Source", "Reçu le", "Commercial", "Dernier commentaire", "Historique (plus récent en haut)", "Exporté le"]];
let found = 0;
for (const r of rows) {
  if (!r?.[0]) continue;
  const x = byPhone.get(digits(r[1]));
  if (x) found++;
  const notes = (x?.notes ?? []).filter((n) => n?.text && !TECH.test(clean(n.text)));
  notes.sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));
  const hist = x
    ? notes.map((n) => {
        let t = clean(n.text);
        if (n.kind === "statut") t = t.replace(/\b([a-z0-9_]+)\b/g, (m) => STATUTS[m] ?? m);
        if (/^(📤|📥)/.test(t)) t = t.slice(0, 90) + (t.length > 90 ? "…" : "");
        return `${ddmm(n.at)} · ${who(n.by)} · ${t}`;
      })
    : String(r[11] ?? "").split(" — ").map(clean).filter((t) => t && !TECH.test(t.replace(/^\[[^\]]*\] [^:]*: /, ""))).reverse();
  const isMail = (t) => /^(📤|📥)/.test(clean(t));
  const lastComment = x ? clean(notes.find((n) => n.kind !== "statut" && !isMail(n.text))?.text ?? "") : clean(r[10]).startsWith("Fiche archivée") ? "" : clean(r[10]);
  out.push([
    clean(r[0]),
    clean(r[1]),
    (x && STATUTS[x.status]) || STATUTS[clean(r[2])] || clean(r[2]),
    [clean(r[4]), clean(r[5])].filter(Boolean).join(" · "),
    clean(r[3]),
    clean(r[8]),
    x ? ddmm(tsIso(x.createdAt)) : clean(r[9]),
    x?.fields?.attribue ?? "",
    lastComment.slice(0, 300),
    hist.join("\n").slice(0, 45000),
    // Jour où la fiche a été envoyée du CRM vers le Sheet (= mise à la corbeille par l'export).
    x?.archivedToDrive ? ddmm(new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(x.deletedAt?.toDate?.() ?? new Date(tsIso(x.deletedAt)))) : "",
  ]);
}
console.log(`Lignes : ${out.length - 1} · retrouvées dans le CRM : ${found}`);
for (const r of out.slice(0, 4)) console.log(JSON.stringify(r).slice(0, 400));
if (dry) { console.log("ESSAI À BLANC : rien n'est écrit."); process.exit(0); }

// Onglet « 📋 Lisible » : créé (ou vidé) en première position, l'onglet d'origine reste intact.
const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets(properties(sheetId,title))" });
let tab = meta.data.sheets.find((s) => s.properties.title === TAB)?.properties.sheetId;
if (tab === undefined) {
  const res = await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: TAB, index: 0, gridProperties: { rowCount: out.length + 10, columnCount: 11, frozenRowCount: 1 } } } }] } });
  tab = res.data.replies[0].addSheet.properties.sheetId;
} else {
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `'${TAB}'` });
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: tab, gridProperties: { columnCount: 11, rowCount: out.length + 10 } }, fields: "gridProperties(columnCount,rowCount)" } }] } });
}
await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1`, valueInputOption: "RAW", requestBody: { values: out } });
const widths = [190, 120, 150, 170, 220, 140, 95, 110, 300, 520, 105];
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SHEET_ID,
  requestBody: {
    requests: [
      ...widths.map((w, i) => ({ updateDimensionProperties: { range: { sheetId: tab, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 }, properties: { pixelSize: w }, fields: "pixelSize" } })),
      { repeatCell: { range: { sheetId: tab, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.42, blue: 0.1 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)" } },
      { repeatCell: { range: { sheetId: tab, startRowIndex: 1 }, cell: { userEnteredFormat: { verticalAlignment: "TOP", wrapStrategy: "CLIP" } }, fields: "userEnteredFormat(verticalAlignment,wrapStrategy)" } },
      { repeatCell: { range: { sheetId: tab, startRowIndex: 1, startColumnIndex: 8, endColumnIndex: 10 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP", textFormat: { fontSize: 9 } } }, fields: "userEnteredFormat(wrapStrategy,textFormat)" } },
      { repeatCell: { range: { sheetId: tab, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } },
      { updateSheetProperties: { properties: { sheetId: tab, gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } }, fields: "gridProperties(frozenRowCount,frozenColumnCount)" } },
      { setBasicFilter: { filter: { range: { sheetId: tab, startRowIndex: 0, endRowIndex: out.length, startColumnIndex: 0, endColumnIndex: 11 } } } },
      { autoResizeDimensions: { dimensions: { sheetId: tab, dimension: "ROWS", startIndex: 1, endIndex: out.length } } },
    ],
  },
});
console.log(`ÉCRIT : onglet « ${TAB} » avec ${out.length - 1} lignes (onglet d'origine intact).`);
