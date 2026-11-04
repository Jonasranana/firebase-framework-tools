// Assistant de relance (CRM) : après un appel, Jonas, Alexis, Carole ou le
// compte contact@ écrivent le compte-rendu dans la fiche ; Claude (Anthropic)
// lit ce texte et l'historique de la fiche et propose la marche à suivre :
// résumé, prochaine action, jour et heure de rappel, étiquette (statut),
// étape du dossier, message de relance. Rien n'est écrit tant que la personne
// n'a pas cliqué sur « Valider » (fonction validerRelance).
//
// NON ACTIVÉ tant que le secret ANTHROPIC_API_KEY n'existe pas dans Secret
// Manager (sinon le déploiement de toutes les fonctions échoue) : voir la
// ligne d'activation en bas de functions/index.js.

const AnthropicModule = require("@anthropic-ai/sdk");
const Anthropic = AnthropicModule.default ?? AnthropicModule;

const MODEL = "claude-opus-5-5";
// Comptes autorisés (identique à NEWS_VIEWERS côté site).
const RELANCE_USERS = ["jonassitbon8@gmail.com", "alexis.sitbon@gmail.com", "carol.sitbon05@gmail.com", "contact@ip5energie.com"];

const SYSTEM = `Tu es l'assistant commercial d'IP5 Énergie, installateur RGE de pompes à chaleur air/eau (et chauffe-eau solaires) en France, hors pourtour méditerranéen et Corse. Les aides (MaPrimeRénov', prime CEE) sont déduites du devis ; IP5 monte les dossiers. Le parcours type d'un client : premier appel, envoi des documents (avis d'imposition de chaque personne du foyer, facture d'énergie, photos du chauffage), création du compte MaPrimeRénov' et signature des demandes, visite technique, devis signé, accord des aides, installation, mise en service.

Après chaque appel, un membre de la famille Sitbon (la direction) écrit un compte-rendu. Ton travail : lire ce compte-rendu et l'historique de la fiche, comprendre ce qui a été négocié, proposé ou demandé, puis dire précisément QUELLE est la prochaine action commerciale et QUAND la faire.

Règles :
- Base-toi uniquement sur le compte-rendu et la fiche. N'invente aucun fait ; si une information manque, dis-le dans « vigilance ».
- La prochaine action est concrète et vérifiable (ex. : « Vérifier qu'il a bien envoyé ses deux avis d'imposition et signé la demande MaPrimeRénov' »).
- Choisis le jour et l'heure de rappel en tenant compte de ce que le client a dit (disponibilités, délais promis, horaires de travail). Sans indication, laisse 2 jours ouvrés pour un document à envoyer, rappelle le lendemain pour un client chaud, et propose 18 h pour quelqu'un qui travaille. Appels du lundi au samedi, entre 9 h et 19 h, jamais le dimanche ni un jour férié. La date doit être dans le futur (au plus tôt aujourd'hui si l'heure n'est pas passée).
- Choisis l'étiquette (statut) et l'étape du dossier dans les listes fournies uniquement ; garde les valeurs actuelles si rien ne justifie un changement (étape vide = ne pas changer).
- Le message de relance (SMS/WhatsApp) est court, poli, vouvoie le client, signé « IP5 Énergie » ; laisse vide s'il n'est pas utile.
- Français simple, phrases courtes.`;

module.exports = function buildRelanceIA({ db, onCall, HttpsError, defineSecret, FieldValue, logger }) {
  const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

  const callerEmail = (request) => String(request.auth?.token?.email ?? "").toLowerCase();
  const assertAllowed = (request) => {
    const email = callerEmail(request);
    if (!request.auth?.token?.email_verified || !RELANCE_USERS.includes(email)) {
      throw new HttpsError("permission-denied", "Fonction réservée à la direction.");
    }
    return email;
  };
  const cleanList = (v) =>
    (Array.isArray(v) ? v : [])
      .map((o) => ({ key: String(o?.key ?? "").slice(0, 60), label: String(o?.label ?? "").slice(0, 80) }))
      .filter((o) => o.label)
      .slice(0, 60);

  // Date et heure de Paris + les 14 prochains jours avec leur nom (pour que
  // « jeudi » devienne la bonne date).
  const parisNow = () => {
    const now = new Date();
    const fmt = (d, o) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...o }).format(d);
    const ymd = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
    const days = [];
    for (let i = 0; i < 15; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      days.push(`${fmt(d, { weekday: "long", day: "numeric", month: "long" })} = ${ymd(d)}`);
    }
    return { label: `${fmt(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${fmt(now, { hour: "2-digit", minute: "2-digit" })}`, days };
  };

  const planifierRelance = onCall({ region: "europe-west9", secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 }, async (request) => {
    assertAllowed(request);
    const leadId = String(request.data?.leadId ?? "");
    const compteRendu = String(request.data?.compteRendu ?? "").trim().slice(0, 8000);
    const statuts = cleanList(request.data?.statuts);
    const etapes = cleanList(request.data?.etapes);
    const etapeKey = String(request.data?.etapeKey ?? "");
    if (!leadId || compteRendu.length < 10 || !statuts.length) throw new HttpsError("invalid-argument", "Compte-rendu trop court.");

    const snap = await db.doc(`crm_leads/${leadId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "Fiche introuvable.");
    const l = snap.data();
    const f = l.fields ?? {};
    const statutActuel = statuts.find((s) => s.key === l.status)?.label ?? l.status ?? "";
    const etapeActuelle = etapes.find((e) => e.key === (etapeKey ? f[etapeKey] : ""))?.label ?? "";
    const notes = (Array.isArray(l.notes) ? l.notes : [])
      .filter((n) => n?.text)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .slice(-25)
      .map((n) => `- ${String(n.at).slice(0, 16).replace("T", " ")} (${n.kind ?? "note"}) ${String(n.text).slice(0, 600)}`)
      .join("\n");
    const details = Object.entries(l.details ?? {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k} : ${String(v).slice(0, 200)}`)
      .join("\n");
    const now = parisNow();

    const prompt = `Nous sommes le ${now.label} (heure de Paris).
Calendrier des prochains jours :
${now.days.join("\n")}

FICHE CLIENT
Nom : ${l.name ?? ""}
Code postal / ville : ${l.postalCode ?? ""} ${l.city ?? ""}
Statut actuel : ${statutActuel}
Étape actuelle du dossier : ${etapeActuelle || "(aucune)"}
Rappel déjà prévu : ${l.rappelLe ? `${l.rappelLe} ${f.rappelHeure ?? ""}` : "aucun"}
Infos du formulaire :
${details || "(aucune)"}

HISTORIQUE (du plus ancien au plus récent) :
${notes || "(vide)"}

COMPTE-RENDU DE L'APPEL D'AUJOURD'HUI :
${compteRendu}

Statuts possibles (clé = libellé) :
${statuts.map((s) => `${s.key} = ${s.label}`).join("\n")}

Étapes possibles (clé = libellé) :
${etapes.length ? etapes.map((e) => `${e.key} = ${e.label}`).join("\n") : "(aucune)"}`;

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["resume", "negocie", "attentes_client", "a_faire_ip5", "prochaine_action", "rappel_date", "rappel_heure", "rappel_alternative", "pourquoi", "statut", "etape", "message_relance", "vigilance"],
      properties: {
        resume: { type: "string", description: "Résumé de l'appel en 2 à 4 phrases." },
        negocie: { type: "array", items: { type: "string" }, description: "Ce qui a été proposé, négocié ou promis pendant l'appel." },
        attentes_client: { type: "array", items: { type: "string" }, description: "Ce que le client doit faire ou envoyer." },
        a_faire_ip5: { type: "array", items: { type: "string" }, description: "Ce qu'IP5 doit faire avant le prochain appel." },
        prochaine_action: { type: "string", description: "L'action exacte à réaliser lors de la prochaine relance." },
        rappel_date: { type: "string", description: "Date de rappel AAAA-MM-JJ." },
        rappel_heure: { type: "string", description: "Heure de rappel HH:MM (24 h)." },
        rappel_alternative: { type: "string", description: "Créneau de secours en clair (ex. « sinon vendredi matin »)." },
        pourquoi: { type: "string", description: "Pourquoi ce délai et ce moment, en une ou deux phrases." },
        statut: { type: "string", enum: statuts.map((s) => s.key) },
        etape: { type: "string", enum: ["", ...etapes.map((e) => e.key)] },
        message_relance: { type: "string", description: "SMS/WhatsApp prêt à envoyer, ou chaîne vide." },
        vigilance: { type: "string", description: "Point d'attention ou information manquante, ou chaîne vide." },
      },
    };

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    let response;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema } },
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (e) {
      logger.error("planifierRelance: erreur API", e?.status, e?.message);
      if (e?.status === 401) throw new HttpsError("failed-precondition", "Clé d'accès à l'IA invalide.");
      if (e?.status === 429) throw new HttpsError("resource-exhausted", "L'IA est saturée, réessayez dans une minute.");
      throw new HttpsError("unavailable", "L'IA ne répond pas, réessayez.");
    }
    if (response.stop_reason === "refusal") throw new HttpsError("aborted", "L'IA n'a pas pu analyser ce compte-rendu.");
    const text = (response.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let plan;
    try {
      plan = JSON.parse(text);
    } catch {
      logger.error("planifierRelance: réponse illisible", response.stop_reason);
      throw new HttpsError("internal", "Réponse de l'IA illisible, réessayez.");
    }
    const u = response.usage ?? {};
    // Coût estimé (Claude Opus 5.5 : 4 $ / 20 $ par million de jetons), pour le suivi.
    const coutUsd = ((u.input_tokens ?? 0) * 4 + (u.output_tokens ?? 0) * 20) / 1e6;
    logger.info("planifierRelance", { leadId, input: u.input_tokens, output: u.output_tokens, coutUsd: Number(coutUsd.toFixed(4)) });
    return { plan, coutUsd };
  });

  const validerRelance = onCall({ region: "europe-west9" }, async (request) => {
    const email = assertAllowed(request);
    const d = request.data ?? {};
    const leadId = String(d.leadId ?? "");
    const compteRendu = String(d.compteRendu ?? "").trim().slice(0, 8000);
    const p = d.plan ?? {};
    const etapeKey = String(d.etapeKey ?? "");
    const labels = d.labels ?? {};
    if (!leadId || !compteRendu) throw new HttpsError("invalid-argument", "Requête invalide.");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(p.rappel_date ?? "")) ? String(p.rappel_date) : "";
    const heure = /^\d{2}:\d{2}$/.test(String(p.rappel_heure ?? "")) ? String(p.rappel_heure) : "";
    const ref = db.doc(`crm_leads/${leadId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Fiche introuvable.");
    const l = snap.data();
    const at = new Date().toISOString();
    const nid = () => Math.random().toString(36).slice(2, 10);
    const list = (title, arr) => (Array.isArray(arr) && arr.length ? `\n${title} :\n${arr.map((x) => `• ${String(x).slice(0, 300)}`).join("\n")}` : "");
    const planText =
      `🤖 Plan de relance\n${String(p.resume ?? "").slice(0, 1200)}` +
      list("Négocié / proposé", p.negocie) +
      list("Le client doit", p.attentes_client) +
      list("IP5 doit", p.a_faire_ip5) +
      `\n➡️ Prochaine action : ${String(p.prochaine_action ?? "").slice(0, 600)}` +
      (date ? `\n📅 Rappel : ${date}${heure ? ` à ${heure}` : ""} — ${String(p.pourquoi ?? "").slice(0, 400)}` : "") +
      (p.rappel_alternative ? `\n(Sinon : ${String(p.rappel_alternative).slice(0, 200)})` : "") +
      (p.vigilance ? `\n⚠️ ${String(p.vigilance).slice(0, 400)}` : "");
    const notes = [
      { id: nid(), text: `📞 Compte-rendu d'appel\n${compteRendu}`, by: email, at, kind: "note" },
      { id: nid(), text: planText, by: email, at, kind: "note" },
    ];
    const patch = { crmOwned: true, updatedAt: FieldValue.serverTimestamp(), updatedBy: email };
    const statut = String(p.statut ?? "");
    let touched = false;
    if (statut && statut !== l.status) {
      patch.status = statut;
      touched = true;
      notes.push({ id: nid(), text: `${labels[l.status] ?? l.status ?? "vide"} → ${labels[statut] ?? statut}`, by: email, at, kind: "statut" });
    }
    const etape = String(p.etape ?? "");
    const etapeAvant = etapeKey ? String(l.fields?.[etapeKey] ?? "") : "";
    if (etapeKey && etape && etape !== etapeAvant) {
      patch[`fields.${etapeKey}`] = etape;
      touched = true;
      notes.push({ id: nid(), text: `Étape : ${labels[etapeAvant] || etapeAvant || "vide"} → ${labels[etape] ?? etape}`, by: email, at, kind: "statut" });
    }
    if (touched) patch.statusChangedAt = FieldValue.serverTimestamp();
    if (date) {
      patch.rappelLe = date;
      patch["fields.rappelHeure"] = heure;
      patch.rappelSetAt = FieldValue.serverTimestamp();
      notes.push({ id: nid(), text: `🔔 Rappel prévu le ${date}${heure ? ` à ${heure}` : ""} (assistant de relance)`, by: email, at, kind: "statut" });
    }
    patch.notes = FieldValue.arrayUnion(...notes);
    await ref.update(patch);
    return { ok: true };
  });

  return { planifierRelance, validerRelance };
};
