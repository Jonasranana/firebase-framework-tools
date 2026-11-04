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

Après chaque appel, un membre de la famille Sitbon (la direction) écrit un compte-rendu. Tu raisonnes comme le meilleur commercial de l'entreprise : ton but est de faire avancer chaque client vers l'installation (documents complets, demandes d'aides signées, visite technique, devis signé), sans le brusquer et sans le perdre. Ton travail : lire ce compte-rendu et l'historique de la fiche, comprendre ce qui a été négocié, proposé ou demandé, repérer le frein principal, puis dire précisément QUELLE est la prochaine action commerciale, QUAND la faire et QUEL argument utiliser.

Règles :
- Base-toi uniquement sur le compte-rendu et la fiche. N'invente aucun fait ; si une information manque, dis-le dans « vigilance ».
- Un client chaud ne doit jamais attendre : relance rapide. Un client hésitant : lever son frein principal (prix, conjoint, confiance, délais) avec un argument concret. Un client injoignable ou pas éligible (locataire, appartement, hors zone) : le dire clairement.
- La prochaine action est concrète et vérifiable (ex. : « Vérifier qu'il a bien envoyé ses deux avis d'imposition et signé la demande MaPrimeRénov' »).
- Choisis le jour et l'heure de rappel en tenant compte de ce que le client a dit (disponibilités, délais promis, horaires de travail). Sans indication, laisse 2 jours ouvrés pour un document à envoyer, rappelle le lendemain pour un client chaud, et propose 18 h pour quelqu'un qui travaille. Appels du lundi au samedi, entre 9 h et 19 h, jamais le dimanche ni un jour férié. La date doit être dans le futur (au plus tôt aujourd'hui si l'heure n'est pas passée).
- Choisis l'étiquette (statut) dans la liste fournie ; garde l'actuelle si rien ne justifie un changement.
- Propose TOUJOURS une étape du dossier, choisie uniquement parmi les étiquettes de la colonne « Étape » fournies, en fonction de l'avancement réel décrit dans le compte-rendu et l'historique ; si rien n'a avancé, reprends l'étape actuelle (si aucune étape n'existe encore, choisis la première étape qui correspond à la situation).
- Le message de relance (SMS/WhatsApp) est court, poli, vouvoie le client, signé « IP5 Énergie » ; laisse vide s'il n'est pas utile.
- SOIS BREF ET RANGÉ : résumé en 2 phrases maximum ; chaque rubrique d'infos client en 10 mots maximum ; chaque liste 3 éléments maximum de 12 mots ; prochaine action en 1 phrase ; argument clé en 1 phrase ; « pourquoi » en 1 phrase courte ; message de relance en 2 phrases maximum. Pas de répétition d'une rubrique à l'autre.
- Dans « infos_client », remplis TOUJOURS les 7 rubriques, avec les informations de l'appel et de la fiche (sinon « Non précisé ») : phrases courtes, sans répéter ailleurs.
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

  const labelsOf = (...lists) => Object.fromEntries(lists.flat().map((o) => [o.key, o.label]));
  const planTextOf = (p, labels = {}) => {
    const list = (title, arr) => (Array.isArray(arr) && arr.length ? `\n${title} :\n${arr.map((x) => `• ${String(x).slice(0, 300)}`).join("\n")}` : "");
    const date = String(p.rappel_date ?? "");
    const heure = String(p.rappel_heure ?? "");
    const ORDRE = [
      ["logement", "🏠 Logement"],
      ["chauffage", "🔥 Chauffage"],
      ["foyer_revenus", "👪 Foyer / revenus"],
      ["projet", "🎯 Projet"],
      ["freins", "🚧 Freins"],
      ["disponibilites", "🕑 Disponibilités"],
      ["documents", "📄 Documents"],
    ];
    const infos = (o) => (o && typeof o === "object" ? `\n👤 ${ORDRE.map(([k, t]) => `${t} : ${String(o[k] ?? "Non précisé").slice(0, 300) || "Non précisé"}`).join(" | ")}` : "");
    const lst = (t, arr) => (Array.isArray(arr) && arr.length ? `\n${t} : ${arr.map((x) => String(x).slice(0, 200)).join(" · ")}` : "");
    return (
      `🤖 Proposition de relance` +
      `\n➡️ ${String(p.prochaine_action ?? "").slice(0, 400)}` +
      (date ? `\n📅 ${date.split("-").reverse().join("/")}${heure ? ` à ${heure}` : ""}${p.pourquoi ? ` (${String(p.pourquoi).slice(0, 200)})` : ""}` : "") +
      (p.statut || p.etape ? `\n🏷️ ${labels[p.statut] ?? p.statut ?? ""}${p.etape ? ` · 🧭 ${labels[p.etape] ?? p.etape}` : ""}` : "") +
      (p.argument_cle ? `\n💬 ${String(p.argument_cle).slice(0, 300)}` : "") +
      `\n\n📝 ${String(p.resume ?? "").slice(0, 600)}` +
      infos(p.infos_client) +
      lst("Négocié", p.negocie) +
      lst("Client doit", p.attentes_client) +
      lst("IP5 doit", p.a_faire_ip5) +
      (p.vigilance ? `\n⚠️ ${String(p.vigilance).slice(0, 300)}` : "")
    );
  };

  const planifierRelance = onCall({ region: "europe-west9", secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 }, async (request) => {
    assertAllowed(request);
    const email = callerEmail(request);
    const leadId = String(request.data?.leadId ?? "");
    const sourceNoteId = String(request.data?.sourceNoteId ?? "");
    let compteRendu = String(request.data?.compteRendu ?? "").trim().slice(0, 8000);
    const statuts = cleanList(request.data?.statuts);
    const etapes = cleanList(request.data?.etapes);
    const etapeKey = String(request.data?.etapeKey ?? "");
    if (!leadId || !statuts.length) throw new HttpsError("invalid-argument", "Requête invalide.");
    const snap = await db.doc(`crm_leads/${leadId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "Fiche introuvable.");
    const l = snap.data();
    // Message choisi dans la discussion : c'est lui le compte-rendu analysé.
    if (sourceNoteId) {
      const src = (Array.isArray(l.notes) ? l.notes : []).find((n) => n?.id === sourceNoteId);
      if (!src?.text) throw new HttpsError("not-found", "Message introuvable.");
      compteRendu = String(src.text).trim().slice(0, 8000);
    }
    if (compteRendu.length < 10) throw new HttpsError("invalid-argument", "Message trop court pour être analysé.");
    const f = l.fields ?? {};
    const statutActuel = statuts.find((s) => s.key === l.status)?.label ?? l.status ?? "";
    const etapeActuelle = etapes.find((e) => e.key === (etapeKey ? f[etapeKey] : ""))?.label ?? "";
    // Historique utile seulement (économie de jetons) : les 20 derniers
    // événements, messages raccourcis à 400 caractères, mouvements à 120,
    // anciennes propositions de l'IA réduites à leur prochaine action.
    const notes = (Array.isArray(l.notes) ? l.notes : [])
      .filter((n) => n?.text && n.id !== sourceNoteId && n.by !== "automation")
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .slice(-20)
      .map((n) => {
        const quand = String(n.at).slice(0, 10);
        if (n.kind === "ia") return `- ${quand} (proposition IA) ${String(n.plan?.prochaine_action ?? "").slice(0, 200)}${n.validatedAt ? " [validée]" : ""}`;
        const max = n.kind === "note" || n.kind === undefined ? 400 : 120;
        return `- ${quand} (${n.kind ?? "note"}) ${String(n.text).replace(/\s+/g, " ").slice(0, max)}`;
      })
      .join("\n");
    const details = Object.entries(l.details ?? {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k} : ${String(v).slice(0, 200)}`)
      .join("\n");
    // Toute la ligne du tableau (colonnes envoyées par le CRM : titre + valeur lisible).
    const ligne = (Array.isArray(request.data?.ligne) ? request.data.ligne : [])
      .map((c) => ({ t: String(c?.titre ?? "").slice(0, 60), v: String(c?.valeur ?? "").replace(/\s+/g, " ").slice(0, 200) }))
      .filter((c) => c.t && c.v)
      .slice(0, 80)
      .map((c) => `${c.t} : ${c.v}`)
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
Ligne complète du tableau :
${ligne || "(non transmise)"}

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
      required: ["resume", "infos_client", "negocie", "attentes_client", "a_faire_ip5", "prochaine_action", "argument_cle", "rappel_date", "rappel_heure", "rappel_alternative", "pourquoi", "statut", "etape", "message_relance", "vigilance"],
      properties: {
        resume: { type: "string", description: "Résumé de l'appel en 2 phrases maximum." },
        infos_client: {
          type: "object",
          additionalProperties: false,
          required: ["logement", "chauffage", "foyer_revenus", "projet", "freins", "disponibilites", "documents"],
          properties: {
            logement: { type: "string", description: "Type de logement, propriétaire ou non, surface, année si connue." },
            chauffage: { type: "string", description: "Chauffage actuel (énergie, âge, état)." },
            foyer_revenus: { type: "string", description: "Composition du foyer et profil de revenus (bleu/jaune/violet/rose)." },
            projet: { type: "string", description: "Projet, motivation, niveau d'intérêt, délai souhaité." },
            freins: { type: "string", description: "Objections, freins, questions en suspens (prix, conjoint, confiance…)." },
            disponibilites: { type: "string", description: "Quand et comment le joindre." },
            documents: { type: "string", description: "Documents reçus / attendus (avis d'imposition, factures, photos, signature MaPrimeRénov'…)." },
          },
        },
        negocie: { type: "array", items: { type: "string" }, description: "Ce qui a été proposé, négocié ou promis pendant l'appel." },
        attentes_client: { type: "array", items: { type: "string" }, description: "Ce que le client doit faire ou envoyer." },
        a_faire_ip5: { type: "array", items: { type: "string" }, description: "Ce qu'IP5 doit faire avant le prochain appel." },
        prochaine_action: { type: "string", description: "L'action exacte à réaliser lors de la prochaine relance." },
        argument_cle: { type: "string", description: "L'argument ou la phrase qui fera avancer ce client au prochain appel (lever son frein principal)." },
        rappel_date: { type: "string", description: "Date de rappel AAAA-MM-JJ." },
        rappel_heure: { type: "string", description: "Heure de rappel HH:MM (24 h)." },
        rappel_alternative: { type: "string", description: "Créneau de secours en clair (ex. « sinon vendredi matin »)." },
        pourquoi: { type: "string", description: "Pourquoi ce moment, 1 phrase courte." },
        statut: { type: "string", enum: statuts.map((s) => s.key) },
        etape: { type: "string", enum: etapes.length ? etapes.map((e) => e.key) : [""] },
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
    // La proposition s'écrit dans la discussion, juste après le message analysé
    // (pas d'e-mail : seul un humain qui valide change la fiche).
    const noteId = Math.random().toString(36).slice(2, 10);
    await db.doc(`crm_leads/${leadId}`).update({
      notes: FieldValue.arrayUnion({
        id: noteId,
        kind: "ia",
        by: "assistant-ia",
        requestedBy: email,
        sourceId: sourceNoteId || "",
        at: new Date().toISOString(),
        text: planTextOf(plan, labelsOf(statuts, etapes)),
        plan,
      }),
    });
    return { plan, coutUsd, noteId };
  });

  const validerRelance = onCall({ region: "europe-west9" }, async (request) => {
    const email = assertAllowed(request);
    const d = request.data ?? {};
    const leadId = String(d.leadId ?? "");
    const noteId = String(d.noteId ?? "");
    const p = d.plan ?? {};
    const etapeKey = String(d.etapeKey ?? "");
    const labels = d.labels ?? {};
    if (!leadId || !noteId) throw new HttpsError("invalid-argument", "Requête invalide.");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(p.rappel_date ?? "")) ? String(p.rappel_date) : "";
    const heure = /^\d{2}:\d{2}$/.test(String(p.rappel_heure ?? "")) ? String(p.rappel_heure) : "";
    const ref = db.doc(`crm_leads/${leadId}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Fiche introuvable.");
      const l = snap.data();
      const notes = Array.isArray(l.notes) ? [...l.notes] : [];
      const i = notes.findIndex((n) => n?.id === noteId && n.kind === "ia");
      if (i < 0) throw new HttpsError("not-found", "Proposition introuvable.");
      if (notes[i].validatedAt) throw new HttpsError("failed-precondition", "Proposition déjà validée.");
      const at = new Date().toISOString();
      const nid = () => Math.random().toString(36).slice(2, 10);
      notes[i] = { ...notes[i], plan: p, text: planTextOf(p, labels), validatedAt: at, validatedBy: email };
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
        notes.push({ id: nid(), text: `🔔 Rappel prévu le ${date.split("-").reverse().join("/")}${heure ? ` à ${heure}` : ""} (assistant de relance)`, by: email, at, kind: "statut" });
      }
      patch.notes = notes;
      tx.update(ref, patch);
    });
    return { ok: true };
  });

  return { planifierRelance, validerRelance };
};
