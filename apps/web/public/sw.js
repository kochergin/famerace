/* FameRace service worker: web push display + click-through. */
self.addEventListener("push", (event) => {
  let data = { title: "FameRace", body: "", link: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      data: { link: data.link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const open = tabs.find((tab) => "focus" in tab);
      if (open) {
        open.navigate(link);
        return open.focus();
      }
      return clients.openWindow(link);
    }),
  );
});
