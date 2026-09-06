import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database, UserRole } from "@/types/database.types";
import { getDefaultRoute } from "@/lib/auth/permissions";

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback"];

// Modules réservés à certains rôles — vérifié après authentification.
const ROLE_RESTRICTED_PREFIXES: { prefix: string; roles: string[] }[] = [
  { prefix: "/dashboard", roles: ["super_admin"] },
  { prefix: "/stores", roles: ["super_admin"] },
  { prefix: "/users", roles: ["super_admin"] },
  { prefix: "/units", roles: ["super_admin", "manager"] },
  { prefix: "/administration", roles: ["super_admin"] },
  { prefix: "/payment-methods", roles: ["super_admin"] },
  { prefix: "/finance", roles: ["super_admin"] },
  { prefix: "/analytics/sales", roles: ["super_admin", "manager", "cashier"] },
  { prefix: "/analytics", roles: ["super_admin"] },
  { prefix: "/audit-log", roles: ["super_admin"] },
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, tenants:tenant_id ( status )")
      .eq("id", user.id)
      .single();

    const role = (profile as { role: UserRole } | null)?.role;
    const defaultRoute = role ? getDefaultRoute(role) : "/dashboard";

    if (path === "/login" || path === "/signup") {
      const url = request.nextUrl.clone();
      url.pathname = defaultRoute;
      return NextResponse.redirect(url);
    }

    const tenantStatus = (profile as unknown as { tenants: { status: string } | null } | null)?.tenants?.status;

    if (path !== "/suspended" && tenantStatus && ["suspended", "cancelled"].includes(tenantStatus)) {
      const url = request.nextUrl.clone();
      url.pathname = "/suspended";
      return NextResponse.redirect(url);
    }

    const restricted = ROLE_RESTRICTED_PREFIXES.find((r) => path.startsWith(r.prefix));
    if (restricted) {
      if (!role || !restricted.roles.includes(role)) {
        const url = request.nextUrl.clone();
        url.pathname = defaultRoute;
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
