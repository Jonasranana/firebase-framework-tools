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
  buildBrandedEmailShell,
  escapeHtmlText,
  SITE_URL,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_SENDER_EMAIL,
}) {
  const callerEmail = (request) => String(request.auth?.token?.email ?? "").toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  async function teamMembers() {
    const snap = await db.collection("crm_team").get();
    const extra = snap.docs.map((d) => ({
      email: d.id,
      name: d.get("name") || d.id,
      root: false,
      addedBy: d.get("addedBy") ?? "",
    }));
    const roots = CRM_ALLOWED_EMAILS.map((e) => ({ email: e, name: ROOT_NAMES[e] ?? e, root: true, addedBy: "" }));
    return [...roots, ...extra.filter((m) => !CRM_ALLOWED_EMAILS.includes(m.email))];
  }

  const manageTeam = onCall({ region: "europe-west9" }, async (request) => {
    if (!isCrmMember(request)) throw new HttpsError("permission-denied", "Accès refusé.");
    const caller = callerEmail(request);
    const { action } = request.data ?? {};
    if (action === "list") return { members: await teamMembers() };

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
      await ref.update({
        notes: FieldValue.arrayUnion({
          id: Math.random().toString(36).slice(2, 10),
          text,
          by: author,
          at: new Date().toISOString(),
          kind: "note",
        }),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: author,
      });

      // E-mail à toute l'équipe (sauf l'auteur). Un échec d'envoi ne doit jamais
      // empêcher l'enregistrement de la mise à jour.
      let notified = 0;
      try {
        const name = snap.get("name") || "(sans nom)";
        const to = members.map((m) => m.email).filter((e) => e !== author);
        if (to.length) {
          const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
          oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });
          const link = `${SITE_URL}/admin#${kind === "lead" ? "leads" : "artisans"}`;
          const html = buildBrandedEmailShell({
            bodyHtml: `
              <p style="margin:0 0 12px 0;"><b>${escapeHtmlText(authorName)}</b> a ajouté une mise à jour sur <b>${escapeHtmlText(name)}</b> :</p>
              <p style="margin:0 0 16px 0; padding:12px 14px; background:#f3f6fb; border-left:4px solid #2b5a8f; white-space:pre-wrap;">${escapeHtmlText(text)}</p>
              <p style="margin:0;"><a href="${link}" style="display:inline-block; background:#2b5a8f; color:#fff; text-decoration:none; padding:10px 18px; border-radius:999px; font-weight:bold;">Ouvrir le CRM</a></p>`,
          });
          const from = GMAIL_SENDER_EMAIL.value();
          for (const addr of to) {
            await gmail.users.messages.send({
              userId: "me",
              requestBody: {
                raw: buildRawMessage({ to: addr, from, subject: `💬 ${authorName} — ${name}`, html }),
              },
            });
            notified++;
          }
        }
      } catch (err) {
        logger.error("Mise à jour CRM : e-mails d'équipe non envoyés", { error: err.message });
      }
      return { ok: true, notified };
    },
  );

  return { manageTeam, claimTeamAccess, postUpdate };
};
