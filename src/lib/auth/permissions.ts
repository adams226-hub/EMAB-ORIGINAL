import type { UserRole } from "@/types/database.types";

export type ModuleKey =
  | "dashboard"
  | "stores"
  | "categories"
  | "products"
  | "users"
  | "settings"
  | "stock_dashboard"
  | "stock_movements"
  | "stock_counts"
  | "stock_in"
  | "stock_out"
  | "units"
  | "pos"
  | "sales"
  | "customers"
  | "receivables"
  | "expenses"
  | "payment_methods"
  | "financial_dashboard"
  | "financial_reports"
  | "analytics"
  | "audit_log";

/**
 * Matrice de permissions. Chaque module liste les rôles autorisés à y
 * accéder. La Phase 3 (ventes, finances) donne enfin un rôle concret au
 * caissier : point de vente, ventes, clients, créances.
 * Les dépenses, dettes fournisseurs et rapports restent des décisions
 * managériales (super_admin / manager).
 */
export const MODULE_PERMISSIONS: Record<ModuleKey, UserRole[]> = {
  dashboard: ["super_admin", "manager", "cashier", "stock_keeper"],
  stores: ["super_admin"],
  categories: ["super_admin", "manager", "stock_keeper"],
  products: ["super_admin", "manager", "stock_keeper"],
  users: ["super_admin"],
  settings: ["super_admin", "manager", "cashier", "stock_keeper"],
  stock_dashboard: ["super_admin", "manager", "stock_keeper"],
  stock_movements: ["super_admin", "manager", "stock_keeper"],
  stock_counts: ["super_admin", "manager", "stock_keeper"],
  stock_in: ["super_admin", "manager", "stock_keeper"],
  stock_out: ["super_admin", "manager", "stock_keeper"],
  units: ["super_admin", "manager"],
  pos: ["super_admin", "manager", "cashier"],
  sales: ["super_admin", "manager", "cashier"],
  customers: ["super_admin", "manager", "cashier"],
  receivables: ["super_admin", "manager", "cashier"],
  expenses: ["super_admin", "manager"],
  payment_methods: ["super_admin", "manager"],
  financial_dashboard: ["super_admin", "manager"],
  financial_reports: ["super_admin", "manager"],
  analytics: ["super_admin", "manager"],
  audit_log: ["super_admin"],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  manager: "Gérant",
  cashier: "Caissier",
  stock_keeper: "Magasinier",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: "Accès total à tous les magasins et modules",
  manager: "Accès complet à son magasin uniquement",
  cashier: "Accès au point de vente, ventes, clients et créances",
  stock_keeper: "Accès à la gestion du stock et des produits",
};

export function canAccessModule(role: UserRole, module: ModuleKey): boolean {
  return MODULE_PERMISSIONS[module]?.includes(role) ?? false;
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "super_admin";
}
