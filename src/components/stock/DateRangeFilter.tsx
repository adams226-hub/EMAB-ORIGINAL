"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from);
    else params.delete("from");
    if (to) params.set("to", to);
    else params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
  }

  function reset() {
    setFrom("");
    setTo("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={applyFilters} className="flex items-end gap-2">
      <div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36 text-xs" />
      </div>
      <div>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36 text-xs" />
      </div>
      <Button type="submit" size="sm">
        Filtrer
      </Button>
      {(from || to || searchParams.get("from") || searchParams.get("to")) && (
        <Button type="button" variant="secondary" size="sm" onClick={reset}>
          Réinitialiser
        </Button>
      )}
    </form>
  );
}
