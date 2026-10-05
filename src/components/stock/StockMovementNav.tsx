"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database.types";

const TABS = [
  { href: "/stock/in", label: "Entrées", roles: null },
  { href: "/stock/out", label: "Sorties", roles: ["super_admin"] as UserRole[] },
  { href: "/stock/transfers", label: "Transferts", roles: null },
  { href: "/stock/movements", label: "Mouvements", roles: null },
];

export function StockMovementNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => !tab.roles || tab.roles.includes(role));

  return (
    <div className="flex gap-1 border-b border-slate-200">
      {visibleTabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
