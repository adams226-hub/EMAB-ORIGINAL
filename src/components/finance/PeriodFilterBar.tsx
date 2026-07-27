"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function PeriodFilterBar({ from, to }: { from: string; to: string }) {
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
    </form>
  );
}
