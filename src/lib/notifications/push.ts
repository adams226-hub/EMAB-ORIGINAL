import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  if (!vapidPublicKey || !vapidPrivateKey) return false;

  webpush.setVapidDetails("mailto:support@emab-erp.com", vapidPublicKey, vapidPrivateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Envoie une notification push à un utilisateur précis (tous ses appareils
 * abonnés). No-op silencieux si les clés VAPID ne sont pas configurées —
 * permet de développer/déployer sans bloquer sur cette intégration
 * optionnelle (voir .env.local.example).
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return;

  const admin = createAdminClient();
  const { data: subscriptions } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);

  await Promise.all(
    (subscriptions ?? []).map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify(payload)
        )
        .catch(async (error: { statusCode?: number }) => {
          // 404/410 : l'abonnement n'est plus valide (désinstallation, expiration) — on le retire.
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        })
    )
  );
}

/**
 * Envoie une notification push à tous les utilisateurs (managers et
 * super_admins) rattachés à un magasin — utilisé pour les alertes stock
 * bas déclenchées par un mouvement de stock.
 */
export async function sendPushToStoreManagers(storeId: string, payload: PushPayload) {
  if (!ensureConfigured()) return;

  const admin = createAdminClient();
  const { data: store } = await admin.from("stores").select("tenant_id").eq("id", storeId).single();
  if (!store) return;

  // Le client admin bypass la RLS : le filtre tenant_id ci-dessous est donc
  // indispensable pour ne jamais notifier une autre entreprise cliente.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", store.tenant_id)
    .in("role", ["manager", "super_admin"])
    .or(`store_id.eq.${storeId},role.eq.super_admin`);

  await Promise.all((profiles ?? []).map((p) => sendPushToUser(p.id, payload)));
}
