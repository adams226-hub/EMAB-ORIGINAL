import { requireRole } from "@/lib/auth/session";
import { toXlsx, xlsxResponse } from "@/lib/xlsx";

const COLUMNS = [
  { key: "name", label: "name" },
  { key: "sku", label: "sku" },
  { key: "category", label: "category" },
  { key: "unit", label: "unit" },
  { key: "purchase_price", label: "purchase_price" },
  { key: "sale_price", label: "sale_price" },
  { key: "description", label: "description" },
] as const;

export async function GET() {
  await requireRole(["super_admin", "manager", "stock_keeper"]);

  const xlsx = toXlsx([] as Record<(typeof COLUMNS)[number]["key"], unknown>[], [...COLUMNS], "Produits");
  return xlsxResponse(xlsx, "modele_produits.xlsx");
}
