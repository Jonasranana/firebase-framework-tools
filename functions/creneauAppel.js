// ─────────────────────────────────────────────────────────────────────────
// Créneau d'appel choisi par le client sur l'écran « Merci » de /pac (facultatif) :
//  - enregistré sur la demande (ip5_leads) et dans la fiche Pac Pac (colonne Rappel :
//    date + heure, et une note « 📅 … ») ;
//  - signalé à l'équipe par une réponse dans la même conversation Gmail que le mail
//    « Nouveau lead » (fil enregistré par notifyNewLead dans ip5_leads.notifThreadId).
// Une seule fois par demande, seulement dans les 2 h qui suivent la demande.
// Ce n'est pas un envoi au client : seulement l'équipe est prévenue.
// ─────────────────────────────────────────────────────────────────────────
module.exports = ({ db, logger, FieldValue, onRequest, google, buildRawMessage, secrets }) => {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL } = secrets;
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  // Heure de Paris : { ymd, h, jourSemaine } maintenant, et date d'un autre jour.
  const paris = (d = new Date()) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
    return { ymd: `${p.year}-${p.month}-${p.day}`, h: Number(p.hour) + Number(p.minute) / 60, dim: /^dim/i.test(p.weekday) };
  };
  const plusJours = (n) => {
    let d = new Date(Date.now() + n * 86400000);
    if (paris(d).dim) d = new Date(d.getTime() + 86400000); // pas d'appel le dimanche
    return paris(d).ymd;
  };
  const jourFr = (ymd) => {
    const auj = paris().ymd;
    if (ymd === auj) return "aujourd'hui";
    if (ymd === plusJours(1) && !paris(new Date(Date.now() + 86400000)).dim) return "demain";
    return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  };

  function calcul(creneau) {
    const n = paris();
    const aujOk = !n.dim;
    if (creneau === "asap") return { ymd: "", heure: "", libelle: "Dès que possible", texte: "dès que possible" };
    if (creneau === "midi") {
      const ymd = aujOk && n.h < 12.5 ? n.ymd : plusJours(1);
      return { ymd, heure: "12:00", libelle: `${jourFr(ymd) === "aujourd'hui" ? "Ce midi" : `${jourFr(ymd)[0].toUpperCase()}${jourFr(ymd).slice(1)} midi`} (12 h – 14 h)`, texte: `${jourFr(ymd)} entre 12 h et 14 h` };
    }
    if (creneau === "soir") {
      const ymd = aujOk && n.h < 17.5 ? n.ymd : plusJours(1);
      return { ymd, heure: "17:00", libelle: `${jourFr(ymd) === "aujourd'hui" ? "Ce soir" : `${jourFr(ymd)[0].toUpperCase()}${jourFr(ymd).slice(1)} soir`} (17 h – 19 h)`, texte: `${jourFr(ymd)} entre 17 h et 19 h` };
    }
    if (creneau === "demain") {
      const ymd = plusJours(1);
      return { ymd, heure: "09:00", libelle: `${jourFr(ymd)[0].toUpperCase()}${jourFr(ymd).slice(1)} matin (9 h – 12 h)`, texte: `${jourFr(ymd)} entre 9 h et 12 h` };
    }
    return null;
  }

  const choisirCreneau = onRequest(
    { region: "europe-west9", cors: true, maxInstances: 3, secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL], timeoutSeconds: 60 },
    async (req, res) => {
      try {
        if (req.method !== "POST") return void res.status(204).send("");
        let b = req.body;
        if (typeof b === "string") b = JSON.parse(b || "{}");
        else if (Buffer.isBuffer(b)) b = JSON.parse(b.toString("utf8") || "{}");
        const leadId = String(b?.leadId ?? "");
        const c = calcul(String(b?.creneau ?? ""));
        if (!/^[A-Za-z0-9]{10,40}$/.test(leadId) || !c) return void res.status(400).json({});
        const ref = db.doc(`ip5_leads/${leadId}`);
        // Une seule fois, dans les 2 h qui suivent la demande.
        const ok = await db.runTransaction(async (tx) => {
          const s = await tx.get(ref);
          if (!s.exists || s.get("creneau")) return null;
          const cree = s.get("createdAt")?.toMillis?.() ?? 0;
          if (!cree || Date.now() - cree > 2 * 3600000) return null;
          tx.update(ref, { creneau: c.libelle, creneauLe: FieldValue.serverTimestamp() });
          return s.data();
        });
        if (!ok) return void res.status(200).json({ libelle: c.libelle });

        // Fiche Pac Pac (même identifiant ; elle peut être créée quelques secondes après la demande).
        const note = { id: Math.random().toString(36).slice(2, 10), text: `📅 Le client a choisi d'être rappelé ${c.texte}.`, by: "Site", at: new Date().toISOString(), kind: "note" };
        for (let i = 0; i < 6; i++) {
          try {
            await db.doc(`crm_leads/${leadId}`).update({ ...(c.ymd ? { rappelLe: c.ymd, "fields.rappelHeure": c.heure } : {}), "fields.creneauAppel": c.libelle, notes: FieldValue.arrayUnion(note) });
            break;
          } catch {
            await attendre(2500);
          }
        }

        // Mail à l'équipe, dans la même conversation que « Nouveau lead » si possible.
        try {
          let thread = "";
          let sujet = "";
          for (let i = 0; i < 6 && !thread; i++) {
            const s = await ref.get();
            thread = s.get("notifThreadId") || "";
            sujet = s.get("notifSujet") || "";
            if (!thread) await attendre(2000);
          }
          const o = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
          o.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
          const gmail = google.gmail({ version: "v1", auth: o });
          const moi = GMAIL_SENDER_EMAIL.value();
          const nom = ok.name || "sans nom";
          const raw = buildRawMessage({
            to: moi,
            from: moi,
            subject: sujet ? `Re: ${sujet}` : `📅 Créneau choisi — ${nom}`,
            html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#173a5e;font-size:15px;"><p style="margin:0 0 8px 0;font-size:17px;font-weight:bold;">📅 ${nom} préfère être appelé ${c.texte}.</p><p style="margin:0;color:#6b7280;font-size:13px;">Choisi sur l'écran « Merci » du site. Le rappel est déjà programmé dans Pac Pac.</p></div>`,
          });
          await gmail.users.messages.send({ userId: "me", requestBody: { raw, ...(thread ? { threadId: thread } : {}) } });
        } catch (e) {
          logger.warn("Créneau d'appel : mail équipe non envoyé", { leadId, error: e.message });
        }
        res.status(200).json({ libelle: c.libelle });
      } catch (e) {
        logger.warn("choisirCreneau", { error: e.message });
        res.status(200).json({});
      }
    },
  );
  return { choisirCreneau };
};
