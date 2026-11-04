// Branchement Meta (formulaires instantanés) → CRM. Lancement manuel.
//  ACTION=verifier : vérifie les 3 secrets META_* et les droits du jeton
//    (aucune écriture, aucun secret affiché).
//  ACTION=brancher : abonne l'app au champ « leadgen » des Pages (URL de la
//    fonction metaLeadWebhook) et installe l'app sur la Page IP5 Énergie.
const GRAPH = "https://graph.facebook.com/v21.0";
const APP_ID = process.env.META_APP_ID;
const { META_APP_SECRET: SECRET, META_PAGE_TOKEN: TOKEN, META_VERIFY_TOKEN: VERIFY, ACTION = "verifier", WEBHOOK_URL } = process.env;
const appToken = `${APP_ID}|${SECRET}`;
const g = async (path, opts = {}) => {
  const r = await fetch(`${GRAPH}/${path}`, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${path.split("?")[0]} → ${j.error?.message ?? r.status}`);
  return j;
};
const qs = (o) => new URLSearchParams(o).toString();
let ok = true;
const check = async (label, fn) => {
  try {
    console.log(`✅ ${label} : ${(await fn()) ?? "ok"}`);
  } catch (e) {
    ok = false;
    console.log(`❌ ${label} : ${e.message}`);
  }
};

for (const [k, v] of Object.entries({ META_APP_SECRET: SECRET, META_PAGE_TOKEN: TOKEN, META_VERIFY_TOKEN: VERIFY }))
  console.log(v ? `✅ Secret ${k} présent (${v.length} caractères)` : `❌ Secret ${k} absent du coffre`);
if (!SECRET || !TOKEN || !VERIFY) process.exit(1);

let page = null;
await check("Clé secrète de l'app (jeton d'app accepté par Meta)", async () => (await g(`${APP_ID}?${qs({ fields: "name", access_token: appToken })}`)).name);
await check("Jeton : type, expiration, autorisations", async () => {
  const d = (await g(`debug_token?${qs({ input_token: TOKEN, access_token: appToken })}`)).data;
  if (!d.is_valid) throw new Error("jeton invalide");
  if (String(d.app_id) !== String(APP_ID)) throw new Error(`jeton fait pour une autre app (${d.app_id})`);
  const need = ["leads_retrieval", "pages_show_list", "pages_manage_metadata", "pages_manage_ads", "pages_read_engagement"];
  const miss = need.filter((s) => !(d.scopes ?? []).includes(s));
  if (miss.length) throw new Error(`autorisations manquantes : ${miss.join(", ")}`);
  return `${d.type}, expire ${d.expires_at ? new Date(d.expires_at * 1000).toISOString().slice(0, 10) : "jamais"}, ${d.scopes.length} autorisations`;
});
await check("Page IP5 Énergie accessible", async () => {
  const pages = (await g(`me/accounts?${qs({ fields: "id,name,access_token", access_token: TOKEN })}`)).data ?? [];
  page = pages.find((p) => /ip5/i.test(p.name)) ?? pages[0];
  if (!page) throw new Error("aucune page : affectez la Page à ip5-crm (Contrôle total)");
  return `${page.name} (${page.id})`;
});
if (page) {
  await check("Formulaires et prospects lisibles (leads_retrieval)", async () => {
    const forms = (await g(`${page.id}/leadgen_forms?${qs({ fields: "id,name,status,leads_count", access_token: page.access_token })}`)).data ?? [];
    return forms.map((f) => `${f.name} [${f.status}] ${f.leads_count ?? "?"} prospects`).join(" | ") || "aucun formulaire";
  });
  await check("App installée sur la Page", async () => {
    const apps = (await g(`${page.id}/subscribed_apps?${qs({ access_token: page.access_token })}`)).data ?? [];
    const me = apps.find((a) => String(a.id) === String(APP_ID));
    return me ? `oui (${(me.subscribed_fields ?? []).join(", ") || "aucun champ"})` : "pas encore";
  });
}
await check("Abonnement webhook de l'app", async () => {
  const subs = (await g(`${APP_ID}/subscriptions?${qs({ access_token: appToken })}`)).data ?? [];
  const p = subs.find((s) => s.object === "page");
  return p ? `${p.callback_url} · ${(p.fields ?? []).map((f) => f.name ?? f).join(", ")} · ${p.active ? "actif" : "inactif"}` : "pas encore";
});

if (ACTION === "brancher") {
  if (!WEBHOOK_URL) throw new Error("WEBHOOK_URL manquant");
  await check("Abonnement de l'app au champ leadgen", async () => {
    await g(`${APP_ID}/subscriptions`, {
      method: "POST",
      body: new URLSearchParams({ object: "page", callback_url: WEBHOOK_URL, verify_token: VERIFY, fields: "leadgen", include_values: "true", access_token: appToken }),
    });
    return WEBHOOK_URL;
  });
  if (page)
    await check("Installation de l'app sur la Page (leadgen)", async () => {
      await g(`${page.id}/subscribed_apps`, { method: "POST", body: new URLSearchParams({ subscribed_fields: "leadgen", access_token: page.access_token }) });
      return page.name;
    });
}
console.log(ok ? "\nTout est bon." : "\nAu moins un point à corriger (voir ❌).");
process.exit(ok ? 0 : 1);
