"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { Store } from "@/types/database.types";

export function SalesFilterBar({ stores, showStore }: { stores: Store[]; showStore: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [storeId, setStoreId] = useState(searchParams.get("store_id") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (storeId) params.set("store_id", storeId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/sales?${params.toString()}`);
  }

  function reset() {
    setSearch("");
    setStatus("");
    setStoreId("");
    setFrom("");
    setTo("");
    router.push("/sales");
  }

  return (
    <form onSubmit={applyFilters} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
      <div className="col-span-2 sm:col-span-1 lg:col-span-2">
        <Input placeholder="Référence, client..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Tous les statuts</option>
        <option value="paid">Payé</option>
        <option value="partial">Partiel</option>
        <option value="unpaid">Impayé</option>
        <option value="cancelled">Annulée</option>
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

      <div className="col-span-2 flex gap-2 sm:col-span-1">
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
