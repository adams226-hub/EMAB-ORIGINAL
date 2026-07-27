"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { Store } from "@/types/database.types";
import { MOVEMENT_TYPE_LABELS } from "./movement-labels";

export function MovementsFilterBar({ stores, showStore }: { stores: Store[]; showStore: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
  const [storeId, setStoreId] = useState(searchParams.get("store_id") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (type) params.set("type", type);
    if (storeId) params.set("store_id", storeId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/stock/movements?${params.toString()}`);
  }

  function reset() {
    setSearch("");
    setType("");
    setStoreId("");
    setFrom("");
    setTo("");
    router.push("/stock/movements");
  }

  return (
    <form onSubmit={applyFilters} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
      <div className="col-span-2 sm:col-span-1 lg:col-span-2">
        <Input
          placeholder="Rechercher un produit, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">Tous les types</option>
        {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      {showStore && (
        <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">Tous les magasins</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}

      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />

      <div className="col-span-2 flex gap-2 sm:col-span-1 lg:col-span-1">
        <Button type="submit" className="flex-1">
          <Search className="h-4 w-4" />
          Filtrer
        </Button>
        <Button type="button" variant="secondary" onClick={reset}>
          Réinitialiser
        </Button>
      </div>
    </form>
  );
}
