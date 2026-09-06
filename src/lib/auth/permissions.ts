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
  | "payment_methods"
  | "financial_dashboard"
  | "financial_reports"
  | "analytics"
  | "sales_report"
  | "audit_log";

/**
 * Matrice de permissions. Chaque module liste les rôles autorisés à y
 * accéder. Tableau de bord, Administration, Dashboard analytique,
 * Finances et Magasins/Utilisateurs restent réservés au Super Admin.
 */
export const MODULE_PERMISSIONS: Record<ModuleKey, UserRole[]> = {
  dashboard: ["super_admin"],
  stores: ["super_admin"],
  categories: ["super_admin", "manager", "cashier", "stock_keeper"],
  products: ["super_admin", "manager", "cashier", "stock_keeper"],
  users: ["super_admin"],
  settings: ["super_admin"],
  stock_dashboard: ["super_admin", "manager", "cashier", "stock_keeper"],
  stock_movements: ["super_admin", "manager", "stock_keeper"],
  stock_counts: ["super_admin", "manager", "cashier", "stock_keeper"],
  stock_in: ["super_admin", "manager", "stock_keeper"],
  stock_out: ["super_admin", "manager", "stock_keeper"],
  units: ["super_admin", "manager"],
  pos: ["super_admin", "manager", "cashier"],
  sales: ["super_admin", "manager", "cashier"],
  customers: ["super_admin", "manager", "cashier"],
  receivables: ["super_admin", "manager", "cashier"],
  payment_methods: ["super_admin"],
  financial_dashboard: ["super_admin"],
  financial_reports: ["super_admin"],
  analytics: ["super_admin"],
  sales_report: ["super_admin", "manager", "cashier"],
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
  manager: "Point de vente, ventes, catalogue, stock et clients, sur tous les magasins",
  cashier: "Point de vente, ventes, catalogue, inventaire, clients et créances",
  stock_keeper: "Entrées/sorties de stock, inventaire et catalogue",
};

export const CREATABLE_ROLES: UserRole[] = ["super_admin", "manager", "cashier", "stock_keeper"];

export function canAccessModule(role: UserRole, module: ModuleKey): boolean {
  return MODULE_PERMISSIONS[module]?.includes(role) ?? false;
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "super_admin";
}

/**
 * Le Gérant voit et opère sur les données de tous les magasins (comme le
 * Super Admin), contrairement au Caissier/Magasinier restreints à leur
 * magasin assigné. N'accorde aucun droit d'administration (Magasins,
 * Utilisateurs, Finances) : uniquement le périmètre des données
 * opérationnelles (ventes, stock, catalogue, clients).
 */
export function hasAllStoresScope(role: UserRole): boolean {
  return role === "super_admin" || role === "manager";
}

/**
 * Page d'atterrissage par défaut après connexion ou en cas d'accès
 * refusé à une page réservée à un autre rôle.
 */
export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/dashboard";
    case "manager":
    case "cashier":
      return "/pos";
    case "stock_keeper":
      return "/stock";
  }
}
