// Équipe du CRM (/admin) et mises à jour des fiches.
//
// - Les 3 administrateurs d'origine sont dans CRM_ALLOWED_EMAILS (index.js) et
//   dans les règles Firestore/Storage. Les personnes ajoutées depuis la page
//   « Équipe » sont listées dans Firestore (crm_team/<e-mail>) et reçoivent
//   l'accès par une « revendication » de leur compte (claim crm = true), que
//   les règles Firestore/Storage acceptent à la place de la liste d'e-mails.
// - postUpdate : ajoute une mise à jour (la « bulle » du tableau) à une fiche
//   et prévient toute l'équipe par e-mail.

const ROOT_NAMES = {
  "jonassitbon8@gmail.com": "Jonas Sitbon",
  "alexis.sitbon@gmail.com": "Alexis Sitbon",
  "carol.sitbon05@gmail.com": "Carole Sitbon",
};

// Personnes que l'on peut taguer dans une bulle avec « @ » (et leurs surnoms).
const MENTIONS = [
  { name: "Carole", email: "carol.sitbon05@gmail.com", keys: ["carole", "carol", "maman"] },
  { name: "Mebarek", email: "mebarouk2012@gmail.com", keys: ["mebarek", "mebarouk", "mebarak"] },
  { name: "Alexis", email: "alexis.sitbon@gmail.com", keys: ["alexis", "papa"] },
  { name: "Jonas", email: "jonassitbon8@gmail.com", keys: ["jonas"] },
];
const findMentions = (text) => {
  const found = [];
  for (const m of String(text).matchAll(/@([\p{L}]+)/gu)) {
    const k = m[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const p = MENTIONS.find((x) => x.keys.includes(k));
    if (p && !found.includes(p)) found.push(p);
  }
  return found;
};

module.exports = function buildCrmTeam({
  db,
  logger,
  google,
  FieldValue,
  getAuth,
  onCall,
  HttpsError,
  CRM_ALLOWED_EMAILS,
  isCrmMember,
  buildRawMessage,
  escapeHtmlText,
  SITE_URL,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_SENDER_EMAIL,
}) {
  const callerEmail = (request) => String(request.auth?.token?.email ?? "").toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Profils (nom d'affichage, poste, téléphone, photo, notifications) : collection
  // crm_profiles/<e-mail>, écrite uniquement par la fonction manageTeam.
  async function teamMembers() {
    const [teamSnap, profSnap] = await Promise.all([db.collection("crm_team").get(), db.collection("crm_profiles").get()]);
    const profiles = Object.fromEntries(profSnap.docs.map((d) => [d.id, d.data()]));
    const extra = teamSnap.docs.map((d) => ({
      email: d.id,
      name: d.get("name") || d.id,
      root: false,
      addedBy: d.get("addedBy") ?? "",
    }));
    const roots = CRM_ALLOWED_EMAILS.map((e) => ({ email: e, name: ROOT_NAMES[e] ?? e, root: true, addedBy: "" }));
    return [...roots, ...extra.filter((m) => !CRM_ALLOWED_EMAILS.includes(m.email))].map((m) => {
      const p = profiles[m.email] ?? {};
      return {
        ...m,
        name: p.name || m.name,
        title: p.title ?? "",
        phone: p.phone ?? "",
        photoUrl: p.photoUrl ?? "",
        notify: p.notify !== false,
      };
    });
  }

  const manageTeam = onCall({ region: "europe-west9" }, async (request) => {
    if (!isCrmMember(request)) throw new HttpsError("permission-denied", "Accès refusé.");
    const caller = callerEmail(request);
    const { action } = request.data ?? {};
    if (action === "list") return { members: await teamMembers() };

    // Modifier un profil : chacun modifie le sien, les administrateurs modifient tous les profils.
    if (action === "update-profile") {
      const email = String(request.data?.email ?? caller).trim().toLowerCase();
      if (email !== caller && !CRM_ALLOWED_EMAILS.includes(caller)) {
        throw new HttpsError("permission-denied", "Vous ne pouvez modifier que votre propre profil.");
      }
      const members = await teamMembers();
      if (!members.some((m) => m.email === email)) throw new HttpsError("not-found", "Personne inconnue.");
      const d = request.data ?? {};
      const patch = { updatedAt: FieldValue.serverTimestamp(), updatedBy: caller };
      if (typeof d.name === "string" && d.name.trim()) patch.name = d.name.trim().slice(0, 80);
      if (typeof d.title === "string") patch.title = d.title.trim().slice(0, 80);
      if (typeof d.phone === "string") patch.phone = d.phone.trim().slice(0, 30);
      if (typeof d.notify === "boolean") patch.notify = d.notify;
      if (typeof d.photoUrl === "string") {
        // Seules les adresses de notre propre stockage sont acceptées.
        if (d.photoUrl && !d.photoUrl.startsWith("https://firebasestorage.googleapis.com/")) {
          throw new HttpsError("invalid-argument", "Photo invalide.");
        }
        patch.photoUrl = d.photoUrl;
      }
      await db.doc(`crm_profiles/${email}`).set(patch, { merge: true });
      return { members: await teamMembers() };
    }

    // Seuls les administrateurs d'origine ajoutent ou retirent quelqu'un.
    if (!CRM_ALLOWED_EMAILS.includes(caller)) {
      throw new HttpsError("permission-denied", "Seuls les administrateurs gèrent l'équipe.");
    }
    const email = String(request.data?.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpsError("invalid-argument", "Adresse e-mail invalide.");
    if (CRM_ALLOWED_EMAILS.includes(email)) throw new HttpsError("invalid-argument", "Cette personne est déjà administratrice.");

    if (action === "add") {
      const name = String(request.data?.name ?? "").trim().slice(0, 80) || email;
      await db.doc(`crm_team/${email}`).set({ email, name, addedBy: caller, addedAt: FieldValue.serverTimestamp() });
      // Si la personne s'est déjà connectée au site, elle reçoit l'accès tout de suite.
      try {
        const u = await getAuth().getUserByEmail(email);
        await getAuth().setCustomUserClaims(u.uid, { ...(u.customClaims ?? {}), crm: true });
      } catch {
        /* pas encore de compte : l'accès sera donné à sa première connexion (claimTeamAccess) */
      }
      logger.info("Équipe CRM : membre ajouté", { by: caller, email });
      return { members: await teamMembers() };
    }
    if (action === "remove") {
      await db.doc(`crm_team/${email}`).delete();
      try {
        const u = await getAuth().getUserByEmail(email);
        await getAuth().setCustomUserClaims(u.uid, { ...(u.customClaims ?? {}), crm: false });
      } catch {
        /* pas de compte : rien à retirer */
      }
      logger.info("Équipe CRM : membre retiré", { by: caller, email });
      return { members: await teamMembers() };
    }
    throw new HttpsError("invalid-argument", "Action inconnue.");
  });

  // Appelée à la connexion par une personne ajoutée à l'équipe mais dont le compte
  // n'a pas encore l'accès : si son e-mail est dans crm_team, on le lui donne.
  const claimTeamAccess = onCall({ region: "europe-west9" }, async (request) => {
    const email = callerEmail(request);
    if (!request.auth?.token?.email_verified || !email) throw new HttpsError("permission-denied", "Accès refusé.");
    const doc = await db.doc(`crm_team/${email}`).get();
    if (!doc.exists) return { ok: false };
    await getAuth().setCustomUserClaims(request.auth.uid, { ...(request.auth.token.customClaims ?? {}), crm: true });
    return { ok: true };
  });

  const postUpdate = onCall(
    {
      secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
      region: "europe-west9",
    },
    async (request) => {
      if (!isCrmMember(request)) throw new HttpsError("permission-denied", "Accès refusé.");
      const author = callerEmail(request);
      const { kind, id } = request.data ?? {};
      const text = String(request.data?.text ?? "").trim().slice(0, 4000);
      if (!["lead", "artisan"].includes(kind) || typeof id !== "string" || !id || !text) {
        throw new HttpsError("invalid-argument", "Requête invalide.");
      }
      const ref = db.doc(`${kind === "lead" ? "crm_leads" : "crm_artisans"}/${id}`);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Fiche introuvable.");

      const members = await teamMembers();
      const authorName = members.find((m) => m.email === author)?.name ?? author;
      const tagged = findMentions(text);
      await ref.update({
        notes: FieldValue.arrayUnion({
          id: Math.random().toString(36).slice(2, 10),
          text,
          by: author,
          at: new Date().toISOString(),
          kind: "note",
          ...(tagged.length ? { mentions: tagged.map((p) => p.name) } : {}),
        }),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: author,
      });

      // E-mail dans la boîte partagée contact@, présenté comme une bulle de discussion. Les personnes taguées
      // avec « @ » (ex. @Carole) le reçoivent AUSSI dans leur boîte personnelle, avec la mention « tagué(e) ».
      // Un échec d'envoi ne doit jamais empêcher l'enregistrement de la mise à jour.
      let notified = 0;
      try {
        const name = snap.get("name") || "(sans nom)";
        const tagLine = tagged.length ? `🏷️ ${tagged.map((p) => p.name).join(", ")} ${tagged.length > 1 ? "ont été tagués" : "a été tagué(e)"} par ${authorName}` : "";
        const to = ["contact@ip5energie.com", ...tagged.map((p) => p.email).filter((e) => e !== author)];
        if (to.length) {
          const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
          oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });
          const link = `${SITE_URL}/admin#${kind === "lead" ? "leads" : "artisans"}`;
          const hhmm = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date());
          const initial = escapeHtmlText((authorName.trim()[0] ?? "?").toUpperCase());
          const html = `<!DOCTYPE html>
<html lang="fr"><body style="margin:0; padding:0; background:#ffffff; font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#efeae2;">
    <tr><td style="background:linear-gradient(120deg,#ff8a00,#ff4d4d 50%,#e0218a); background-color:#ff5a4d; padding:14px 18px; color:#ffffff;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:40px; height:40px; background:#ffffff33; border-radius:20px; text-align:center; color:#ffffff; font-weight:bold; font-size:18px;" width="40">${initial}</td>
        <td style="padding-left:12px; color:#ffffff;">
          <div style="font-size:16px; font-weight:bold; line-height:1.2;">${escapeHtmlText(authorName)}</div>
          <div style="font-size:13px; opacity:.92; line-height:1.4;">sur la fiche ${escapeHtmlText(name)}</div>
        </td>
      </tr></table>
    </td></tr>
    ${tagLine ? `<tr><td style="padding:14px 16px 0 16px;"><div style="background:#fff4e5; border:1px solid #ffd19a; border-radius:10px; padding:8px 12px; color:#9a4a00; font-size:14px; font-weight:bold;">${escapeHtmlText(tagLine)}</div></td></tr>` : ""}
    <tr><td style="padding:22px 16px 10px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:88%;"><tr>
        <td style="background:#ffffff; border-radius:0 14px 14px 14px; padding:10px 14px 6px 14px; color:#1f2a37; font-size:16px; line-height:1.45; box-shadow:0 1px 1px rgba(0,0,0,.13);">
          <div style="font-size:13px; font-weight:bold; color:#d6246e; margin-bottom:3px;">${escapeHtmlText(authorName)}</div>
          <div style="white-space:pre-wrap;">${escapeHtmlText(text)}</div>
          <div style="text-align:right; font-size:11px; color:#8a94a3; padding-top:4px;">${hhmm}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 16px 16px 16px; font-size:0; line-height:0;">&nbsp;</td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td align="left" style="padding:18px 16px 26px 16px;">
      <a href="${link}" style="display:inline-block; background:#ff5a4d; color:#ffffff; text-decoration:none; padding:10px 20px; border-radius:999px; font-weight:bold; font-size:14px;">Ouvrir dans le CRM</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
          const from = GMAIL_SENDER_EMAIL.value();
          for (const addr of to) {
            await gmail.users.messages.send({
              userId: "me",
              requestBody: {
                raw: buildRawMessage({
                  to: addr,
                  from,
                  subject: tagged.length ? `🏷️ ${authorName} a tagué ${tagged.map((p) => p.name).join(", ")} — ${name}` : `💬 ${authorName} — ${name}`,
                  html,
                }),
              },
            });
            notified++;
          }
        }
      } catch (err) {
        logger.error("Mise à jour CRM : e-mails d'équipe non envoyés", { error: err.message });
      }
      return { ok: true, notified, tagged: tagged.map((p) => p.name) };
    },
  );

  return { manageTeam, claimTeamAccess, postUpdate };
};
