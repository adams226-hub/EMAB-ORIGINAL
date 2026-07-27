export type PeriodPreset = "today" | "week" | "month" | "year" | "custom";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Résout un préréglage de période en bornes from/to (incluses), et calcule
 * la période précédente de même durée pour le calcul de croissance.
 */
export function resolvePeriod(preset: PeriodPreset, customFrom?: string, customTo?: string) {
  const now = new Date();
  let from: Date;
  let to: Date;

  switch (preset) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = from;
      break;
    case "week": {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
      to = now;
      break;
    }
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      to = now;
      break;
    case "custom":
      from = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
      to = customTo ? new Date(customTo) : now;
      break;
    case "month":
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
      break;
  }

  const fromStr = toISODate(from);
  const toStr = toISODate(to);
  const durationMs = to.getTime() - from.getTime();

  const previousTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const previousFrom = new Date(previousTo.getTime() - durationMs);

  return {
    from: fromStr,
    to: toStr,
    previousFrom: toISODate(previousFrom),
    previousTo: toISODate(previousTo),
  };
}

export function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
  custom: "Personnalisé",
};
