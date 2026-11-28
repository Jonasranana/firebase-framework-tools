// ─────────────────────────────────────────────────────────────────────────
// Relance des demandes incomplètes du site : une personne a laissé ses coordonnées
// (avec son accord pour être recontactée) puis n'a pas fini le simulateur. 1 h après,
// si personne de l'équipe ne l'a encore contactée, un seul SMS l'invite à terminer.
//  - Entre 9 h et 20 h (heure de Paris) seulement ; sinon le SMS attend le créneau suivant
//    (au plus 6 h après la demande : au-delà, on laisse l'équipe rappeler).
//  - Une seule fois par fiche (repère lead_relance_incomplet/<id>), trace dans la fiche.
//  - Jamais pour les campagnes de réactivation ou WhatsApp, ni si la fiche a été traitée.
// Activé le 28/11/2026 avec l'accord de Jonas (texte validé). ACTIF = false pour couper.
// ─────────────────────────────────────────────────────────────────────────
const ACTIF = true;

module.exports = ({ db, logger, FieldValue, onSchedule, toE164French, sendTwilioSms, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN }) => {
  const texte = (prenom) =>
    `IP5 Énergie : ${prenom ? `bonjour ${prenom}, ` : "bonjour, "}il ne vous reste que quelques questions pour connaître vos aides pour la pompe à chaleur : https://ip5energie.fr/pac — ou un conseiller vous rappelle : 07 49 52 52 67.`;

  const relanceIncomplets = onSchedule(
    { schedule: "every 15 minutes", timeZone: "Europe/Paris", region: "europe-west9", secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN], timeoutSeconds: 120 },
    async () => {
      if (!ACTIF) return;
      const heure = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }).format(new Date()));
      if (heure < 9 || heure >= 20) return;
      const snap = await db.collection("crm_leads").where("source", ">=", "Site (incomplet)").where("source", "<", "Site (incomplet)").get();
      const now = Date.now();
      let envoyes = 0;
      for (const d of snap.docs) {
        const x = d.data();
        if (x.deletedAt || (x.board ?? "leads") !== "leads") continue;
        if (/reactivation|whatsapp/i.test(String(x.source))) continue;
        if (x.status && x.status !== "nouveau_lead") continue;
        if ((x.notes ?? []).some((n) => /@/.test(n?.by ?? ""))) continue; // déjà contactée par l'équipe
        const cree = x.createdAt?.toMillis?.() ?? 0;
        if (!cree || now - cree < 3600000 || now - cree > 6 * 3600000) continue;
        const to = toE164French(x.phone);
        if (!to || !/^\+33[67]/.test(to)) continue; // portables seulement
        const marker = db.doc(`lead_relance_incomplet/${d.id}`);
        try {
          await marker.create({ at: new Date().toISOString(), to });
        } catch (e) {
          if (e.code === 6) continue;
          throw e;
        }
        const prenom = String(x.name ?? "").trim().split(/\s+/)[0] ?? "";
        const body = texte(prenom ? prenom[0].toUpperCase() + prenom.slice(1).toLowerCase() : "");
        const ok = await sendTwilioSms({ to, body, accountSid: TWILIO_ACCOUNT_SID.value(), authToken: TWILIO_AUTH_TOKEN.value() });
        if (!ok) {
          await marker.delete().catch(() => {});
          logger.warn("Relance incomplet : SMS non envoyé", { id: d.id });
          continue;
        }
        envoyes++;
        await d.ref.update({
          notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 10), text: `💬 SMS de relance envoyé (demande incomplète) : « ${body} »`, by: "automation", at: new Date().toISOString(), kind: "message" }),
        });
      }
      if (envoyes) logger.info("Relance des demandes incomplètes", { envoyes });
    },
  );
  return { relanceIncomplets };
};
