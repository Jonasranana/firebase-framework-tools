// Création d'automatisations en langage naturel (bouton « Automatiser » du CRM).
// - draftAutomation : transforme une phrase (« quand un lead passe en "Intéressé", préviens l'équipe »)
//   en règle structurée, que le CRM affiche pour confirmation. Rien n'est créé ici.
// - aiSettings : lit / enregistre la clé de l'IA (réservé à jonassitbon8@gmail.com).
// La clé est gardée côté serveur (Firestore crm_private/ai, inaccessible depuis le navigateur).

const AI_ADMIN = "jonassitbon8@gmail.com";
const MODEL = "claude-haiku-5-5";

const ACTIONS_DOC = `Types d'actions possibles (champ "type") :
- notify_team : prévenir toute l'équipe par e-mail. Champs : message (texte facultatif).
- send_template : envoyer au lead un modèle de mail + SMS. Champs : template (nom EXACT parmi la liste fournie), mail (true/false), sms (true/false).
- send_email : envoyer au lead un e-mail libre depuis la boîte contact@ (texte simple, sans image ni pièce jointe). Champs : subject, body.
- send_sms : envoyer un SMS libre au lead (via Twilio). Champs : text.
- move_group : déplacer le lead dans un groupe. Champs : groupId (identifiant EXACT parmi la liste fournie).
- set_column : changer la valeur d'une colonne. Champs : col (clé EXACTE), value (clé EXACTE de l'option pour une colonne à étiquettes, sinon texte).
- set_date : mettre une date. Champs : col (clé d'une colonne de type date), days (nombre de jours à partir d'aujourd'hui).
- add_note : ajouter une note dans l'historique de la fiche. Champs : text.
Dans les textes (message, text) on peut écrire {nom}, {telephone}, {email}, {ville}.`;

module.exports = function buildCrmAiAutomation({ db, logger, onCall, HttpsError, isCrmMember, FieldValue }) {
  const callerEmail = (request) => String(request.auth?.token?.email ?? "").toLowerCase();
  const keyRef = db.doc("crm_private/ai");

  const aiSettings = onCall({ region: "europe-west9" }, async (request) => {
    if (!isCrmMember(request)) throw new HttpsError("permission-denied", "Accès refusé.");
    const email = callerEmail(request);
    const snap = await keyRef.get();
    const configured = !!snap.get("anthropicKey");
    const { action } = request.data ?? {};
    if (action === "save") {
      if (email !== AI_ADMIN) throw new HttpsError("permission-denied", "Réservé à Jonas.");
      const key = String(request.data?.key ?? "").trim();
      if (key && !/^sk-ant-/.test(key)) throw new HttpsError("invalid-argument", "Cette clé ne ressemble pas à une clé Anthropic (elle commence par sk-ant-).");
      await keyRef.set({ anthropicKey: key, by: email, at: FieldValue.serverTimestamp() }, { merge: true });
      return { configured: !!key, canConfigure: true, canUse: true };
    }
    return { configured, canConfigure: email === AI_ADMIN, canUse: email === AI_ADMIN };
  });

  const draftAutomation = onCall({ region: "europe-west9", timeoutSeconds: 60 }, async (request) => {
    if (!isCrmMember(request)) throw new HttpsError("permission-denied", "Accès refusé.");
    if (callerEmail(request) !== AI_ADMIN) throw new HttpsError("permission-denied", "Réservé à Jonas.");
    const key = (await keyRef.get()).get("anthropicKey");
    if (!key) throw new HttpsError("failed-precondition", "no-key");

    const text = String(request.data?.text ?? "").trim().slice(0, 1500);
    if (!text) throw new HttpsError("invalid-argument", "Décrivez ce que vous voulez.");
    const ctx = request.data?.context ?? {};
    const columns = (Array.isArray(ctx.columns) ? ctx.columns : []).slice(0, 80).map((c) => ({
      key: String(c.key),
      title: String(c.title),
      type: String(c.type),
      options: Array.isArray(c.options) ? c.options.slice(0, 60).map((o) => ({ key: String(o.key), label: String(o.label) })) : undefined,
    }));
    const groups = (Array.isArray(ctx.groups) ? ctx.groups : []).slice(0, 40).map((g) => ({ id: String(g.id), title: String(g.title) }));
    const templates = (Array.isArray(ctx.templates) ? ctx.templates : []).slice(0, 20).map(String);

    const system = `Tu aides une petite entreprise (IP5 Énergie, pompes à chaleur) à créer des automatisations dans son CRM. L'utilisateur décrit en français ce qu'il veut ; tu réponds UNIQUEMENT par un objet JSON, sans texte autour, sans balises.

Forme de la réponse :
{"name": "titre court", "explanation": "une phrase simple en français qui résume : quand ... alors ...", "trigger": <déclencheur>, "actions": [<action>, ...]}
ou, si la demande est trop vague : {"error": "ce qu'il manque, en une phrase, avec une question"}
ou, si la demande dépasse ces possibilités (images ou pièces jointes dans un mail, PDF, nouveau modèle de mail illustré, nouvelle colonne ou nouvelle fonction du CRM, autre logiciel, règle trop compliquée) : {"error": "ce qui n'est pas possible ici", "needsDesktop": true}

Déclencheur (champ "trigger") :
- {"type": "created"} : quand un nouveau lead est créé ;
- {"type": "column_changes", "col": "<clé de colonne>", "value": "<clé d'option ou chaîne vide pour toute valeur>"} : quand la valeur d'une colonne change (colonne de type status de préférence).

${ACTIONS_DOC}

Règles : utilise uniquement les colonnes, options, groupes et modèles de la liste fournie (clés exactes). Si l'utilisateur cite une étiquette, retrouve son option par son libellé. Ne devine pas : en cas de doute réponds avec "error". Maximum 4 actions. N'invente jamais de numéros ni d'adresses.`;

    const user = `Colonnes : ${JSON.stringify(columns)}\nGroupes : ${JSON.stringify(groups)}\nModèles Mail+SMS : ${JSON.stringify(templates)}\n\nDemande : ${text}`;

    let out;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 900, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(45000),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.error("draftAutomation : API refusée", { status: res.status, body });
        if (res.status === 401) throw new HttpsError("failed-precondition", "bad-key");
        if (res.status === 402 || res.status === 429) throw new HttpsError("resource-exhausted", "quota");
        throw new HttpsError("internal", "api-error");
      }
      out = String(body.content?.[0]?.text ?? "");
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      logger.error("draftAutomation : échec", { error: e.message });
      throw new HttpsError("unavailable", "api-unreachable");
    }

    let parsed;
    try {
      parsed = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    } catch {
      return { error: "Je n'ai pas bien compris, pouvez-vous reformuler ?" };
    }
    if (parsed.error) return { error: String(parsed.error), needsDesktop: !!parsed.needsDesktop };

    // Validation stricte : rien d'inconnu ne passe.
    const colByKey = new Map(columns.map((c) => [c.key, c]));
    const t = parsed.trigger ?? {};
    let trigger;
    if (t.type === "created") trigger = { type: "created" };
    else if (t.type === "column_changes" && colByKey.has(t.col)) {
      const c = colByKey.get(t.col);
      const value = String(t.value ?? "");
      if (value && c.options && !c.options.some((o) => o.key === value)) return { error: "Je n'ai pas retrouvé cette étiquette dans la colonne. Pouvez-vous la préciser ?" };
      trigger = { type: "column_changes", col: t.col, value };
    } else return { error: "Je n'ai pas compris quand ça doit se déclencher." };

    const actions = [];
    for (const a of Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4) : []) {
      switch (a?.type) {
        case "notify_team": actions.push({ type: "notify_team", message: String(a.message ?? "").slice(0, 500) }); break;
        case "send_template":
          if (!templates.includes(a.template)) return { error: "Je n'ai pas retrouvé ce modèle de mail. Lequel voulez-vous ?" };
          actions.push({ type: "send_template", template: a.template, mail: a.mail !== false, sms: a.sms !== false });
          break;
        case "send_email": if (a.body) actions.push({ type: "send_email", subject: String(a.subject ?? "IP5 Énergie").slice(0, 150), body: String(a.body).slice(0, 3000) }); break;
        case "send_sms": if (a.text) actions.push({ type: "send_sms", text: String(a.text).slice(0, 480) }); break;
        case "move_group":
          if (!groups.some((g) => g.id === a.groupId)) return { error: "Je n'ai pas retrouvé ce groupe. Lequel voulez-vous ?" };
          actions.push({ type: "move_group", groupId: a.groupId });
          break;
        case "set_column": {
          const c = colByKey.get(a.col);
          if (!c) return { error: "Je n'ai pas retrouvé la colonne à modifier." };
          if (c.options && !c.options.some((o) => o.key === a.value)) return { error: "Je n'ai pas retrouvé l'étiquette à mettre dans la colonne." };
          actions.push({ type: "set_column", col: a.col, value: String(a.value ?? "") });
          break;
        }
        case "set_date":
          if (!colByKey.has(a.col)) return { error: "Je n'ai pas retrouvé la colonne de date." };
          actions.push({ type: "set_date", col: a.col, days: Math.max(-365, Math.min(365, Number(a.days) || 0)) });
          break;
        case "add_note": if (a.text) actions.push({ type: "add_note", text: String(a.text).slice(0, 500) }); break;
        default: break;
      }
    }
    if (!actions.length) return { error: "Je n'ai pas compris ce qu'il faut faire. Pouvez-vous préciser ?" };
    return { name: String(parsed.name ?? "").slice(0, 80), explanation: String(parsed.explanation ?? "").slice(0, 400), trigger, actions };
  });

  return { aiSettings, draftAutomation };
};
