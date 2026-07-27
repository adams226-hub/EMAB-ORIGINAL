import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/database.types";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";
import { MobileMenuButton } from "./MobileMenuButton";

export function Header({
  fullName,
  role,
  storeName,
}: {
  fullName: string;
  role: UserRole;
  storeName: string | null;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
      <div className="flex items-center">
        <MobileMenuButton />
        <div>
          <p className="text-sm font-medium text-slate-900">{fullName}</p>
          <p className="text-xs text-slate-500">
            {ROLE_LABELS[role]}
            {storeName ? ` · ${storeName}` : role === "super_admin" ? " · Tous les magasins" : ""}
          </p>
        </div>
      </div>

      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </form>
    </header>
  );
}
