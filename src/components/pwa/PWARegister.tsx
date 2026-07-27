"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // En dev, le rechargement du serveur change le JS à chaque fois ;
      // un service worker cache-first servirait des chunks périmés et
      // casserait silencieusement l'interactivité côté client.
      navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // L'app reste pleinement fonctionnelle sans service worker
        // (juste sans cache hors-ligne) — jamais bloquant.
      });
    }
  }, []);

  return null;
}
