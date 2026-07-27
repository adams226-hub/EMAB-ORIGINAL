"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { subscribeToPush, unsubscribeFromPush } from "@/app/(dashboard)/settings/push-actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function PushNotificationToggle({ vapidPublicKey }: { vapidPublicKey?: string }) {
  const [isPending, startTransition] = useTransition();
  const [subscribed, setSubscribed] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(Boolean(sub)))
    );
  }, []);

  function handleEnable() {
    if (!vapidPublicKey) {
      setError("Les notifications push ne sont pas configurées côté serveur (clé VAPID absente).");
      return;
    }

    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("Autorisation refusée par le navigateur.");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const result = await subscribeToPush(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
        if (result.error) {
          setError(result.error);
          return;
        }
        setError(undefined);
        setSubscribed(true);
      } catch {
        setError("Impossible d'activer les notifications sur cet appareil.");
      }
    });
  }

  function handleDisable() {
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    });
  }

  if (!supported) {
    return <p className="text-sm text-slate-400">Notifications push non supportées par ce navigateur.</p>;
  }

  return (
    <div className="space-y-2">
      <FormError message={error} />
      <p className="text-sm text-slate-500">
        Recevez une alerte instantanée (stock bas, créances en retard) même quand l&apos;application est
        fermée.
      </p>
      {subscribed ? (
        <Button variant="secondary" onClick={handleDisable} disabled={isPending}>
          <BellOff className="h-4 w-4" />
          Désactiver les notifications
        </Button>
      ) : (
        <Button onClick={handleEnable} disabled={isPending}>
          <Bell className="h-4 w-4" />
          Activer les notifications
        </Button>
      )}
    </div>
  );
}
