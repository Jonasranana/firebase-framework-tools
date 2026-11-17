// Service worker du CRM IP5 (appli installée) : affiche les notifications envoyées
// par le serveur (functions/crmPush.js) et ouvre la bonne page au clic.
// Ne met rien en cache : le site reste toujours à jour.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch (e) {
    p = { data: { title: "CRM IP5", body: event.data ? event.data.text() : "" } };
  }
  const d = p.data || p.notification || {};
  const title = d.title || "CRM IP5";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/crm-icon-192.png",
      badge: "/crm-badge-96.png",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/admin", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).pathname.startsWith("/admin") && "focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
