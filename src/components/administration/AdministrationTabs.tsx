"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { canAccessModule } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/database.types";

type TabKey = "stores" | "users" | "settings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "stores", label: "Magasins" },
  { key: "users", label: "Utilisateurs" },
  { key: "settings", label: "Paramètres" },
];

export function AdministrationTabs({
  role,
  children,
}: {
  role: UserRole;
  children: Record<TabKey, ReactNode>;
}) {
  const visibleTabs = TABS.filter((tab) => canAccessModule(role, tab.key));
  const [active, setActive] = useState<TabKey>(visibleTabs[0]?.key ?? "settings");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Administration</h1>
        <p className="mt-1 text-sm text-slate-500">Magasins, utilisateurs et paramètres</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active === tab.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>{children[active]}</div>
    </div>
  );
}
