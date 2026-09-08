"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { Store } from "@/types/database.types";

export function PeriodFilterBar({
  from,
  to,
  stores,
}: {
  from: string;
  to: string;
  stores?: Store[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", fromDate);
    params.set("to", toDate);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setStore(storeId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (storeId) params.set("store_id", storeId);
    else params.delete("store_id");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label className="label-base">Du</label>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </div>
      <div>
        <label className="label-base">Au</label>
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>
      <Button type="submit">Appliquer</Button>

      {stores && (
        <div className="ml-auto">
          <label className="label-base">Magasin</label>
          <Select value={searchParams.get("store_id") ?? ""} onChange={(e) => setStore(e.target.value)} className="w-56">
            <option value="">Tous les magasins</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </form>
  );
}
