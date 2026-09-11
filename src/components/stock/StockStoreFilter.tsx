"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/Select";
import type { Store } from "@/types/database.types";

export function StockStoreFilter({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStore(storeId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (storeId) params.set("store_id", storeId);
    else params.delete("store_id");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={searchParams.get("store_id") ?? ""} onChange={(e) => setStore(e.target.value)} className="w-56">
      <option value="">Tous les magasins</option>
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
