import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultRoute } from "@/lib/auth/permissions";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  redirect(profile ? getDefaultRoute(profile.role) : "/login");
}
