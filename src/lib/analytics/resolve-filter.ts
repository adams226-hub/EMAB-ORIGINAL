import { resolvePeriod, type PeriodPreset } from "./period";
import type { UserRole } from "@/types/database.types";

const VALID_PRESETS: PeriodPreset[] = ["today", "week", "month", "year", "custom"];

export interface AnalyticsSearchParams {
  period?: string;
  from?: string;
  to?: string;
  store_id?: string;
}

export function resolveAnalyticsFilter(
  searchParams: AnalyticsSearchParams,
  profile: { role: UserRole; store_id: string | null }
) {
  const preset: PeriodPreset = VALID_PRESETS.includes(searchParams.period as PeriodPreset)
    ? (searchParams.period as PeriodPreset)
    : "month";

  const { from, to, previousFrom, previousTo } = resolvePeriod(preset, searchParams.from, searchParams.to);

  const storeId = profile.role === "super_admin" ? searchParams.store_id || null : profile.store_id;

  return { preset, from, to, previousFrom, previousTo, storeId };
}
