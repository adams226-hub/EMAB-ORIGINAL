import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Client "service role" — bypasse RLS. Ne doit JAMAIS être importé côté
 * client ni exposé au navigateur. Réservé aux Server Actions qui gèrent
 * le cycle de vie des comptes Supabase Auth (création/suppression d'utilisateurs).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
