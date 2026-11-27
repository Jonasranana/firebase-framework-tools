// ─────────────────────────────────────────────────────────────────────────
// « Dire à Meta qui sont les bons clients » (API Conversions de Meta).
// Quand un lead venu des pubs Meta devient intéressé (ou plus) puis signé dans
// le CRM, le serveur l'envoie à Meta : Meta apprend alors à chercher des gens
// qui ressemblent aux clients qui avancent et signent, pas aux « NRP ».
//
// Réglages : Firestore crm_meta_capi_config/reglages (saisis par Jonas dans la page Pub Meta) :
//   { actif: true, token: "…", pixels: "1241790268079116,2258957188215331", testCode?: "TEST123", version?: "v23.0" }
// Sans jeton ou si actif ≠ true : rien n'est envoyé.
// Données envoyées : seulement chiffrées (SHA-256) — téléphone, e-mail, prénom, nom,
// code postal, pays, identifiant de la fiche — comme le demande Meta.
// Une seule fois par fiche et par étape (repère fields metaCapi.<étape> sur la fiche).
// Journal : crm_meta_capi_log (lu dans la page Pub Meta).
// ─────────────────────────────────────────────────────────────────────────
const crypto = require("node:crypto");

module.exports = ({ db, logger, FieldValue, onDocumentUpdated }) => {
  const sha = (v) => crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

  // Noms des étiquettes ajoutées dans le CRM (clés o_…), relus toutes les 10 minutes.
  let labels = {};
  let labelsAt = 0;
  async function libelle(key) {
    if (Date.now() - labelsAt > 600000) {
      try {
        const cfg = (await db.doc("crm_boards/leads_columns").get()).data()?.config ?? {};
        const out = {};
        const visit = (v) => {
          if (Array.isArray(v)) for (const o of v) { if (o && typeof o === "object" && o.key && o.label) out[o.key] = o.label; visit(o); }
          else if (v && typeof v === "object") for (const x of Object.values(v)) visit(x);
        };
        visit(cfg);
        labels = out;
        labelsAt = Date.now();
      } catch {
        /* garde l'ancienne liste */
      }
    }
    return String(labels[key] ?? key ?? "");
  }

  const QUALIFIE = /^(interesse|rdv_pris|proposition_envoyee|propal_praimy|propal_recu|instal_prevu|vt_praimy|vt_faite_bets|en_cours_bets|installer_bets|attente_docs|docs_recu)$/;
  async function etape(status) {
    const s = String(status ?? "");
    const l = await libelle(s);
    if (s === "o_yt99h" || /^\s*sign/i.test(l)) return "signe";
    if (QUALIFIE.test(s) || /propal|int[ée]ress|rdv|devis|visite|vt\b|docs? re/i.test(l)) return "qualifie";
    return null;
  }

  const vientDeMeta = (x) => {
    if (x.fields?.vientDeMeta === "oui") return true;
    if (x.fields?.vientDeMeta === "non") return false;
    const src = String(x.source ?? "");
    return /^(landing-pac-meta|simulateur-landing|formulaire-facebook)/.test(src) || (/^site \(incomplet\)/i.test(src) && !/whatsapp|reactivation/i.test(src));
  };

  function userData(id, x) {
    const u = { country: [sha("fr")], external_id: [sha(id)] };
    let tel = String(x.phone ?? "").replace(/[^\d+]/g, "");
    if (tel.startsWith("+")) tel = tel.slice(1);
    else if (tel.startsWith("00")) tel = tel.slice(2);
    else if (tel.startsWith("0") && tel.length === 10) tel = `33${tel.slice(1)}`;
    if (tel.length >= 10) u.ph = [sha(tel)];
    if (/@/.test(x.email ?? "")) u.em = [sha(x.email)];
    const [prenom, ...nom] = String(x.name ?? "").trim().split(/\s+/);
    if (norm(prenom)) u.fn = [sha(norm(prenom))];
    if (nom.length && norm(nom.join(""))) u.ln = [sha(norm(nom.join("")))];
    const cp = String(x.postalCode ?? x.fields?.cp ?? "").replace(/\D/g, "").slice(0, 5);
    if (cp.length === 5) u.zp = [sha(cp)];
    // Formulaire Facebook : l'identifiant du lead Meta permet un rapprochement exact.
    const leadId = x.fields?.metaLeadId || x.metaLeadId;
    if (leadId) u.lead_id = String(leadId);
    return u;
  }

  async function envoyer(cfg, id, x, quoi) {
    const pixels = String(cfg.pixels || "1241790268079116,2258957188215331").split(/[,\s]+/).filter((p) => /^\d{6,20}$/.test(p));
    const version = /^v\d+\.\d+$/.test(cfg.version ?? "") ? cfg.version : "v23.0";
    const nom = quoi === "signe" ? "Purchase" : "QualifiedLead";
    const valeur = Number(String(x.fields?.margeNette ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")) || (quoi === "signe" ? 1000 : 0);
    const evt = {
      event_name: nom,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "system_generated",
      event_id: `${id}_${quoi}`,
      user_data: userData(id, x),
      custom_data: { event_source: "crm", lead_event_source: "CRM IP5 Energie", ...(valeur ? { value: valeur, currency: "EUR" } : {}) },
    };
    for (const pixel of pixels) {
      let ok = false;
      let reponse = "";
      try {
        const r = await fetch(`https://graph.facebook.com/${version}/${pixel}/events?access_token=${encodeURIComponent(cfg.token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: [evt], ...(cfg.testCode ? { test_event_code: String(cfg.testCode) } : {}) }),
        });
        reponse = (await r.text()).slice(0, 300);
        ok = r.ok;
      } catch (e) {
        reponse = String(e?.message ?? e).slice(0, 300);
      }
      await db.collection("crm_meta_capi_log").add({ at: FieldValue.serverTimestamp(), leadId: id, nom: String(x.name ?? "").split(/\s+/)[0] ?? "", etape: quoi, evenement: nom, pixel, ok, reponse, test: !!cfg.testCode });
      if (!ok) logger.warn("API Conversions Meta : envoi refusé", { id, pixel, reponse });
    }
  }

  return {
    metaCapiEtapeLead: onDocumentUpdated({ document: "crm_leads/{leadId}", region: "europe-west9", maxInstances: 3 }, async (event) => {
      const avant = event.data?.before?.data();
      const apres = event.data?.after?.data();
      if (!avant || !apres || apres.deletedAt) return;
      if (avant.status === apres.status && avant.fields?.vientDeMeta === apres.fields?.vientDeMeta) return;
      if ((apres.board || "leads") !== "leads" || !vientDeMeta(apres)) return;
      const quoi = await etape(apres.status);
      if (!quoi) return;
      // Pas activé (pas de jeton) : on ne marque rien, pour envoyer normalement une fois activé.
      const cfg = (await db.doc("crm_meta_capi_config/reglages").get()).data() ?? {};
      if (cfg.actif !== true || !cfg.token) return;
      const id = event.params.leadId;
      // Un signé est aussi un lead qualifié : les deux étapes sont envoyées (une fois chacune).
      const aFaire = quoi === "signe" ? ["qualifie", "signe"] : ["qualifie"];
      for (const q of aFaire) {
        if (apres.metaCapi?.[q]) continue;
        // Repère posé avant l'envoi : jamais deux fois la même étape, même si la fonction est rejouée.
        const ref = db.doc(`crm_meta_capi_envoyes/${id}_${q}`);
        try {
          await ref.create({ at: FieldValue.serverTimestamp() });
        } catch (e) {
          if (e.code === 6) continue;
          throw e;
        }
        try {
          await envoyer(cfg, id, apres, q);
          await db.doc(`crm_leads/${id}`).update({ [`metaCapi.${q}`]: new Date().toISOString() });
        } catch (e) {
          logger.warn("API Conversions Meta : erreur", { id, error: e.message });
        }
      }
    }),
  };
};
