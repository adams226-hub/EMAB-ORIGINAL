"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Écoute les changements en temps réel sur le stock (Supabase Realtime)
 * et rafraîchit les données du Server Component parent. La RLS s'applique
 * toujours : seuls les événements des lignes visibles par l'utilisateur
 * (son magasin, ou tout si super_admin) sont reçus.
 */
export function RealtimeStockWatcher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("stock-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_stock" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
