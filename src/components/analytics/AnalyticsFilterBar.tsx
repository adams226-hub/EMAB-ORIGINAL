"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { Store } from "@/types/database.types";
import { PERIOD_PRESET_LABELS, type PeriodPreset } from "@/lib/analytics/period";

const PRESETS: PeriodPreset[] = ["today", "week", "month", "year"];

export function AnalyticsFilterBar({
  preset,
  from,
  to,
  stores,
  showStore,
}: {
  preset: PeriodPreset;
  from: string;
  to: string;
  stores: Store[];
  showStore: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function setPreset(p: PeriodPreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyCustom() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setStore(storeId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (storeId) params.set("store_id", storeId);
    else params.delete("store_id");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              preset === p ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {PERIOD_PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
        <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-36 text-xs" />
        <span className="text-xs text-slate-400">→</span>
        <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-36 text-xs" />
        <Button size="sm" variant="secondary" onClick={applyCustom}>
          Appliquer
        </Button>
      </div>

      {showStore && (
        <Select
          className="ml-auto h-8 w-48 text-xs"
          value={searchParams.get("store_id") ?? ""}
          onChange={(e) => setStore(e.target.value)}
        >
          <option value="">Tous les magasins</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
