import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { UsersManager, type UserRow } from "@/components/users/UsersManager";
import type { Profile } from "@/types/database.types";

export const dynamic = "force-dynamic";

type ProfileWithStore = Profile & { stores: { name: string } | null };

export default async function UsersPage() {
  const profile = await requireRole(["super_admin"]);
  const supabase = createClient();

  const [{ data: users }, { data: stores }] = await Promise.all([
    supabase.from("profiles").select("*, stores:store_id ( name )").order("created_at"),
    supabase.from("stores").select("*").eq("is_active", true).order("name"),
  ]);

  const rows: UserRow[] = ((users ?? []) as unknown as ProfileWithStore[]).map(({ stores: store, ...rest }) => ({
    ...rest,
    store_name: store?.name ?? null,
  }));

  return <UsersManager users={rows} stores={stores ?? []} currentUserId={profile.id} />;
}
