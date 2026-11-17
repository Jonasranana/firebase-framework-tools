// ─────────────────────────────────────────────────────────────────────────
// Notifications du CRM sur téléphone / ordinateur (CRM installé comme appli
// depuis Chrome, ou Safari sur iPhone). Chaque appareil qui active les
// notifications enregistre son jeton FCM dans crm_push_tokens/<id> (écrit
// seulement par le serveur), avec ses choix :
//   leads    : 📥 nouveau lead (site, Facebook, rappel demandé…)
//   rappels  : ⏰ rappel dans 20 min (personne qui doit rappeler)
//   tags     : 💬 tagué(e) avec @ dans une discussion
//   planning : 🗓️ chaque soir, pré-visites et poses du lendemain
// Un jeton refusé par Google (appareil désinstallé…) est supprimé tout seul.
// ─────────────────────────────────────────────────────────────────────────
const crypto = require("crypto");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const KINDS = ["leads", "rappels", "tags", "planning"];
const DEFAULT_PREFS = { leads: true, rappels: true, tags: true, planning: true };
// Sources des demandes qui arrivent toutes seules (pas les imports ni les fiches saisies à la main).
const AUTO_SOURCE = /landing|simulateur|site|formulaire-facebook|facebook|contact|rappel|whatsapp/i;

module.exports = function buildCrmPush({ db, logger, onCall, HttpsError, isCrmMember, PLANNING_VIEWERS }) {
  const tokenId = (token) => crypto.createHash("sha256").update(token).digest("hex").slice(0, 40);
  const cleanPrefs = (p) => Object.fromEntries(KINDS.map((k) => [k, p && typeof p[k] === "boolean" ? p[k] : DEFAULT_PREFS[k]]));

  // Envoie une notification aux appareils qui l'ont choisie (option : seulement certaines adresses).
  async function sendPush({ kind, emails, title, body, url = "/admin", tag }) {
    try {
      let q = db.collection("crm_push_tokens").where(`prefs.${kind}`, "==", true);
      const snap = await q.get();
      const wanted = emails ? new Set(emails.map((e) => String(e).toLowerCase())) : null;
      const docs = snap.docs.filter((d) => !wanted || wanted.has(String(d.get("email")).toLowerCase()));
      if (!docs.length) return 0;
      const res = await getMessaging().sendEach(
        docs.map((d) => ({
          token: d.get("token"),
          data: { title: String(title).slice(0, 120), body: String(body ?? "").slice(0, 300), url, tag: tag || kind },
          webpush: { headers: { Urgency: "high", TTL: "86400" } },
        })),
      );
      await Promise.all(
        res.responses.map((r, i) =>
          !r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(r.error?.code ?? "")
            ? docs[i].ref.delete()
            : null,
        ),
      );
      logger.info("Notifications envoyées", { kind, ok: res.successCount, ko: res.failureCount });
      return res.successCount;
    } catch (err) {
      logger.error("Notifications : envoi échoué", { kind, error: err.message });
      return 0;
    }
  }

  // Appareil : enregistrer / changer les choix / désactiver / tester.
  const crmPushToken = onCall({ region: "europe-west9" }, async (request) => {
    if (!isCrmMember(request)) throw new HttpsError("permission-denied", "Accès refusé.");
    const email = String(request.auth.token.email).toLowerCase();
    const { action, token } = request.data ?? {};
    if (typeof token !== "string" || token.length < 20 || token.length > 4096) throw new HttpsError("invalid-argument", "Jeton invalide.");
    const ref = db.doc(`crm_push_tokens/${tokenId(token)}`);
    if (action === "unregister") {
      await ref.delete();
      return { ok: true };
    }
    if (action === "get") {
      const s = await ref.get();
      return { ok: true, registered: s.exists && s.get("email") === email, prefs: s.exists ? cleanPrefs(s.get("prefs")) : DEFAULT_PREFS };
    }
    if (action === "register" || action === "prefs") {
      const prefs = cleanPrefs(request.data?.prefs);
      await ref.set({ token, email, prefs, device: String(request.data?.device ?? "").slice(0, 120), updatedAt: new Date().toISOString() }, { merge: true });
      return { ok: true, prefs };
    }
    if (action === "test") {
      const s = await ref.get();
      if (!s.exists) throw new HttpsError("failed-precondition", "Notifications non activées sur cet appareil.");
      await getMessaging().send({
        token,
        data: { title: "🔔 Notifications activées", body: "Le CRM IP5 vous préviendra ici.", url: "/admin", tag: "test" },
        webpush: { headers: { Urgency: "high" } },
      });
      return { ok: true };
    }
    throw new HttpsError("invalid-argument", "Action inconnue.");
  });

  // 📥 Nouveau lead arrivé tout seul (site, formulaire Facebook…).
  const pushNewLead = onDocumentCreated({ document: "crm_leads/{leadId}", region: "europe-west9" }, async (event) => {
    const x = event.data?.data();
    if (!x || x.deletedAt || !AUTO_SOURCE.test(String(x.source ?? ""))) return;
    const name = String(x.name || "Nouveau client").trim();
    const where = [x.city, x.postalCode].filter(Boolean).join(" ");
    const src = /facebook/i.test(x.source) ? "Formulaire Facebook" : /incomplet/i.test(x.source) ? "Site (demande incomplète)" : "Site";
    await sendPush({
      kind: "leads",
      title: `📥 Nouveau lead : ${name}`,
      body: [where, src, x.phone].filter(Boolean).join(" · "),
      url: `/admin?lead=${encodeURIComponent(event.params.leadId)}`,
      tag: `lead-${event.params.leadId}`,
    });
  });

  // 🗓️ Chaque soir à 19 h : pré-visites et poses du lendemain.
  const pushPlanningDemain = onSchedule({ schedule: "every day 19:00", timeZone: "Europe/Paris", region: "europe-west1" }, async () => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(new Date(Date.now() + 86400000))
        .map((v) => [v.type, v.value]),
    );
    const demain = `${p.year}-${p.month}-${p.day}`;
    const [vt, pose] = await Promise.all([
      db.collection("crm_leads").where("fields.dateVt", "==", demain).get(),
      db.collection("crm_leads").where("fields.datePose", "==", demain).get(),
    ]);
    const ligne = (d, heureKey) => {
      const h = String(d.get(`fields.${heureKey}`) ?? "").trim();
      return `${h ? `${h} ` : ""}${d.get("name") || "?"}${d.get("city") ? ` (${d.get("city")})` : ""}`;
    };
    const vts = vt.docs.filter((d) => !d.get("deletedAt")).map((d) => ligne(d, "heureVt"));
    const poses = pose.docs.filter((d) => !d.get("deletedAt")).map((d) => ligne(d, "heurePose"));
    if (!vts.length && !poses.length) return;
    const body = [poses.length ? `🔧 Poses : ${poses.join(", ")}` : "", vts.length ? `🔍 Pré-visites : ${vts.join(", ")}` : ""].filter(Boolean).join("\n");
    await sendPush({ kind: "planning", emails: PLANNING_VIEWERS, title: `🗓️ Demain : ${poses.length} pose(s), ${vts.length} pré-visite(s)`, body, url: "/admin#planning", tag: `planning-${demain}` });
  });

  return { sendPush, exports: { crmPushToken, pushNewLead, pushPlanningDemain } };
};
