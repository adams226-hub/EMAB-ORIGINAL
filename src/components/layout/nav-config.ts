import type { ModuleKey } from "@/lib/auth/permissions";
import {
  LayoutDashboard,
  Store,
  Tags,
  Package,
  Users,
  Settings,
  Warehouse,
  History,
  ClipboardList,
  Ruler,
  ShoppingBag,
  Receipt,
  UserRound,
  Wallet,
  Banknote,
  Landmark,
  LineChart,
  FileBarChart,
  BarChart3,
  TrendingUp,
  PackagePlus,
  PackageMinus,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: ModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Général",
    items: [{ key: "dashboard", label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Analytique & BI",
    items: [
      { key: "analytics", label: "Dashboard analytique", href: "/analytics", icon: BarChart3 },
      { key: "analytics", label: "Rapport ventes", href: "/analytics/sales", icon: TrendingUp },
    ],
  },
  {
    label: "Ventes & Finances",
    items: [
      { key: "pos", label: "Point de vente", href: "/pos", icon: ShoppingBag },
      { key: "sales", label: "Ventes", href: "/sales", icon: Receipt },
      { key: "customers", label: "Clients", href: "/customers", icon: UserRound },
      { key: "expenses", label: "Dépenses", href: "/expenses", icon: Wallet },
      { key: "cash_register", label: "Caisse", href: "/cash-register", icon: Banknote },
      { key: "financial_dashboard", label: "Dashboard financier", href: "/finance", icon: LineChart },
      { key: "financial_reports", label: "Rapports financiers", href: "/finance/reports", icon: FileBarChart },
      { key: "payment_methods", label: "Modes de paiement", href: "/payment-methods", icon: Landmark },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { key: "categories", label: "Catégories", href: "/categories", icon: Tags },
      { key: "products", label: "Produits", href: "/products", icon: Package },
      { key: "units", label: "Unités", href: "/units", icon: Ruler },
    ],
  },
  {
    label: "Stock",
    items: [
      { key: "stock_dashboard", label: "Vue d'ensemble stock", href: "/stock", icon: Warehouse },
      { key: "stock_in", label: "Entrées de stock", href: "/stock/in", icon: PackagePlus },
      { key: "stock_out", label: "Sorties de stock", href: "/stock/out", icon: PackageMinus },
      { key: "stock_movements", label: "Mouvements", href: "/stock/movements", icon: History },
      { key: "stock_counts", label: "Inventaires", href: "/stock/counts", icon: ClipboardList },
    ],
  },
  {
    label: "Administration",
    items: [
      { key: "stores", label: "Magasins", href: "/stores", icon: Store },
      { key: "users", label: "Utilisateurs", href: "/users", icon: Users },
      { key: "audit_log", label: "Journal d'audit", href: "/audit-log", icon: History },
      { key: "settings", label: "Paramètres", href: "/settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
