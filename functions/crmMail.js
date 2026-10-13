// Synchronisation de la boîte mail contact@ avec le CRM.
//
// À chaque demande (document crm_mail_requests/{id}, créé par le workflow
// GitHub « Sync boîte mail » toutes les 15 min ou par le bouton « Actualiser »
// du CRM), la fonction lit les nouveaux mails de la boîte (reçus ET envoyés),
// retrouve la fiche lead ou artisan dont l'adresse e-mail correspond, et :
//   - ajoute le mail (objet + extrait) dans l'historique de la fiche ;
//   - enregistre les pièces jointes dans le stockage de la fiche
//     (Storage crm/leads|artisans/<id>/ + index crm_documents) ;
//   - pour un mail reçu, repère la fiche (enveloppe dans le tableau).
// Les mails d'expéditeurs inconnus et les envois automatiques sont ignorés.
//
// Nécessite un refresh token Gmail avec le droit de LECTURE
// (gmail.readonly) en plus de gmail.send : voir functions/README.md,
// « Connecter la lecture de la boîte mail ».

const crypto = require("node:crypto");

const BUCKET = "kachoto-7554c.firebasestorage.app";
const LOOKBACK_FIRST_RUN_DAYS = 14;
const MAX_MESSAGES_PER_RUN = 300;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const BUDGET_MS = 7 * 60 * 1000;

const AUTOMATED_FROM = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?@|newsletter|bounce)/i;

const header = (msg, name) =>
  (msg.payload?.headers ?? []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

const addresses = (value) =>
  Array.from(String(value ?? "").matchAll(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)).map((m) =>
    m[0].toLowerCase(),
  );

const decode = (data) => Buffer.from(String(data ?? ""), "base64url");

function walkParts(part, out = []) {
  if (!part) return out;
  out.push(part);
  for (const p of part.parts ?? []) walkParts(p, out);
  return out;
}

function bodyText(msg) {
  const parts = walkParts(msg.payload);
  const plain = parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
  let text;
  if (plain) text = decode(plain.body.data).toString("utf8");
  else {
    const html = parts.find((p) => p.mimeType === "text/html" && p.body?.data);
    text = html
      ? decode(html.body.data)
          .toString("utf8")
          .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
          .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
      : msg.snippet ?? "";
  }
  // Coupe la citation du message précédent (« Le … a écrit : », lignes « > »).
  const cut = text.search(/\n\s*(Le .{5,80} a écrit|On .{5,80} wrote|De :|From:|-----Original|_{5,})/i);
  if (cut > 0) text = text.slice(0, cut);
  text = text
    .split("\n")
    .filter((l) => !l.trim().startsWith(">"))
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.slice(0, 600);
}

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

module.exports = function buildCrmMail({
  db,
  logger,
  google,
  FieldValue,
  getStorage,
  onDocumentCreated,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_SENDER_EMAIL,
}) {
  const stateRef = db.doc("crm_mail_state/main");

  async function findOwners(addr) {
    const owners = [];
    for (const [coll, type] of [
      ["crm_leads", "lead"],
      ["crm_artisans", "artisan"],
    ]) {
      const snap = await db.collection(coll).where("email", "==", addr).limit(3).get();
      for (const d of snap.docs) owners.push({ ref: d.ref, type, id: d.id, name: d.get("name") ?? "" });
    }
    return owners;
  }

  async function saveAttachment({ gmail, msg, part, owner, direction }) {
    const size = part.body?.size ?? 0;
    const mime = part.mimeType ?? "application/octet-stream";
    const inline = /inline/i.test(header({ payload: part }, "Content-Disposition")) || header({ payload: part }, "Content-ID");
    // Logos de signature et petites images décoratives : ignorés.
    if (inline && size < 100 * 1024) return null;
    if (/^image\//.test(mime) && size < 15 * 1024) return null;
    if (size > MAX_ATTACHMENT_BYTES) return null;

    let buf;
    if (part.body?.attachmentId) {
      const att = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: msg.id,
        id: part.body.attachmentId,
      });
      buf = decode(att.data.data);
    } else if (part.body?.data) buf = decode(part.body.data);
    else return null;

    const name = part.filename;
    const safe = name.replace(/[^\w.\- ()àâäçéèêëîïôöùûüÿ]/gi, "_").slice(0, 120);
    const path = `crm/${owner.type === "lead" ? "leads" : "artisans"}/${owner.id}/${Date.now()}_${safe}`;
    const token = crypto.randomUUID();
    await getStorage()
      .bucket(BUCKET)
      .file(path)
      .save(buf, { contentType: mime, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    const category = guessCategory(name);
    const docId = `mail_${msg.id}_${(part.body?.attachmentId ?? "x").slice(-12).replace(/[^\w]/g, "")}_${owner.id}`;
    await db.doc(`crm_documents/${docId}`).set({
      ownerType: owner.type,
      ownerId: owner.id,
      ownerName: owner.name,
      name,
      category,
      size: buf.length,
      contentType: mime,
      path,
      url,
      source: "mail",
      uploadedBy: direction === "in" ? "mail reçu" : "mail envoyé",
      createdAt: FieldValue.serverTimestamp(),
    });
    return { category, name };
  }

  async function processMessage({ gmail, id, ownEmail }) {
    const msg = (await gmail.users.messages.get({ userId: "me", id, format: "full" })).data;
    const labels = msg.labelIds ?? [];
    const outbound = labels.includes("SENT");
    const from = addresses(header(msg, "From"));
    if (!outbound) {
      const fromRaw = header(msg, "From");
      const auto = header(msg, "Auto-Submitted");
      if (
        AUTOMATED_FROM.test(fromRaw) ||
        (auto && auto.toLowerCase() !== "no") ||
        /bulk|list|junk/i.test(header(msg, "Precedence")) ||
        header(msg, "List-Unsubscribe")
      ) {
        return { matched: 0 };
      }
    }
    const counterparts = (outbound ? [...addresses(header(msg, "To")), ...addresses(header(msg, "Cc"))] : from).filter(
      (a) => a !== ownEmail,
    );
    const subject = header(msg, "Subject") || "(sans objet)";
    const at = new Date(Number(msg.internalDate) || Date.now()).toISOString();
    const text = bodyText(msg);
    const attachments = walkParts(msg.payload).filter((p) => p.filename);

    let matched = 0;
    const seenOwners = new Set();
    for (const addr of new Set(counterparts)) {
      for (const owner of await findOwners(addr)) {
        if (seenOwners.has(owner.ref.path)) continue;
        seenOwners.add(owner.ref.path);
        matched++;
        const saved = [];
        for (const part of attachments) {
          try {
            const r = await saveAttachment({ gmail, msg, part, owner, direction: outbound ? "out" : "in" });
            if (r) saved.push(r);
          } catch (err) {
            logger.error("Mail CRM : pièce jointe non enregistrée", { id, file: part.filename, error: err.message });
          }
        }
        const note = {
          id: Math.random().toString(36).slice(2, 10),
          text:
            `${outbound ? "📤 Mail envoyé" : "📥 Mail reçu"} — ${subject}` +
            (text ? `\n${text}` : "") +
            (saved.length ? `\n📎 ${saved.map((s) => s.name).join(", ")}` : ""),
          by: outbound ? ownEmail : addr,
          at,
          kind: "mail",
        };
        const patch = {
          notes: FieldValue.arrayUnion(note),
          lastMailAt: at,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (!outbound) patch.mailNonLu = true;
        if (saved.length) {
          patch.docCount = FieldValue.increment(saved.length);
          patch.docCats = FieldValue.arrayUnion(...saved.map((s) => s.category));
        }
        await owner.ref.update(patch);
      }
    }
    return { matched };
  }

  const syncMailbox = onDocumentCreated(
    {
      document: "crm_mail_requests/{requestId}",
      secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
      region: "europe-west9",
      timeoutSeconds: 540,
      memory: "1GiB",
    },
    async (event) => {
      const started = Date.now();
      // Verrou : une seule synchronisation à la fois (évite les doublons).
      const locked = await db.runTransaction(async (tx) => {
        const s = (await tx.get(stateRef)).data() ?? {};
        if (s.runningSince && Date.now() - s.runningSince < 10 * 60 * 1000) return false;
        tx.set(stateRef, { runningSince: Date.now() }, { merge: true });
        return true;
      });
      await event.data?.ref.delete().catch(() => {});
      if (!locked) return;

      try {
        const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
        oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        let ownEmail = String(GMAIL_SENDER_EMAIL.value()).toLowerCase();
        try {
          ownEmail = (await gmail.users.getProfile({ userId: "me" })).data.emailAddress?.toLowerCase() ?? ownEmail;
        } catch (err) {
          const scope = err.code === 403 || /insufficient/i.test(err.message);
          await stateRef.set(
            {
              ok: false,
              reason: scope ? "scope" : "error",
              message: scope
                ? "Le jeton Gmail n'a pas le droit de lire la boîte mail (il faut ajouter gmail.readonly)."
                : err.message,
              lastRunAt: FieldValue.serverTimestamp(),
              runningSince: FieldValue.delete(),
            },
            { merge: true },
          );
          logger.error("Boîte mail CRM : lecture impossible", { error: err.message });
          return;
        }

        const state = (await stateRef.get()).data() ?? {};
        const since = state.lastSuccessAtMs
          ? Math.floor((state.lastSuccessAtMs - 60 * 60 * 1000) / 1000)
          : Math.floor(Date.now() / 1000) - LOOKBACK_FIRST_RUN_DAYS * 86400;

        const ids = [];
        let pageToken;
        do {
          const r = await gmail.users.messages.list({
            userId: "me",
            q: `after:${since} -in:draft`,
            maxResults: 100,
            pageToken,
          });
          ids.push(...(r.data.messages ?? []).map((m) => m.id));
          pageToken = r.data.nextPageToken;
        } while (pageToken && ids.length < MAX_MESSAGES_PER_RUN);

        let processed = 0;
        let matched = 0;
        let complete = true;
        // Les plus anciens d'abord : l'historique reste dans l'ordre.
        for (const id of ids.reverse()) {
          if (Date.now() - started > BUDGET_MS) {
            complete = false;
            break;
          }
          const seenRef = db.doc(`crm_mail_seen/${id}`);
          if ((await seenRef.get()).exists) continue;
          try {
            const r = await processMessage({ gmail, id, ownEmail });
            matched += r.matched;
            processed++;
            await seenRef.set({ at: FieldValue.serverTimestamp(), matched: r.matched });
          } catch (err) {
            logger.error("Mail CRM : message non traité", { id, error: err.message });
          }
        }
        await stateRef.set(
          {
            ok: true,
            reason: FieldValue.delete(),
            message: `${processed} nouveau(x) mail(s), ${matched} rangé(s) dans une fiche`,
            email: ownEmail,
            lastRunAt: FieldValue.serverTimestamp(),
            ...(complete ? { lastSuccessAtMs: started } : {}),
            runningSince: FieldValue.delete(),
          },
          { merge: true },
        );
        logger.info("Boîte mail CRM synchronisée", { processed, matched, complete });
      } catch (err) {
        logger.error("Boîte mail CRM : échec", { error: err.message });
        await stateRef.set(
          { ok: false, reason: "error", message: err.message, lastRunAt: FieldValue.serverTimestamp(), runningSince: FieldValue.delete() },
          { merge: true },
        );
      }
    },
  );

  return { syncMailbox };
};
