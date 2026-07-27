import { formatCurrency } from "@/lib/utils";

export type ChartValueFormat = "currency" | "number" | "percent";

/**
 * Les fonctions ne peuvent pas traverser la frontière Server → Client
 * Component (RSC) : les pages (Server Components) passent un simple
 * littéral sérialisable ("currency" | "number" | "percent") plutôt
 * qu'une fonction de formatage — le composant client résout lui-même
 * le formateur réel.
 */
export function formatChartValue(value: number, format: ChartValueFormat = "number"): string {
  if (format === "currency") return formatCurrency(value);
  if (format === "percent") return `${value}%`;
  return value.toLocaleString("fr-FR");
}
