"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Rafraîchit le dashboard analytique dès qu'une vente, un paiement ou une
 * dépense est enregistré ailleurs dans l'application — le pilotage reste
 * à jour sans rechargement manuel. La RLS s'applique toujours : seuls les
 * événements des lignes visibles par l'utilisateur sont reçus.
 */
export function RealtimeAnalyticsWatcher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("analytics-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
