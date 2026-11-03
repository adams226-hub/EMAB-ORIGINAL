"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ProductFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [product, setProduct] = useState(searchParams.get("product") ?? "");

  function applyFilter(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (product) params.set("product", product);
    else params.delete("product");
    router.push(`${pathname}?${params.toString()}`);
  }

  function reset() {
    setProduct("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("product");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={applyFilter} className="flex items-end gap-2">
      <Input
        placeholder="Produit (nom ou SKU)..."
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        className="h-9 w-48 text-xs"
      />
      <Button type="submit" size="sm">
        Filtrer
      </Button>
      {(product || searchParams.get("product")) && (
        <Button type="button" variant="secondary" size="sm" onClick={reset}>
          Réinitialiser
        </Button>
      )}
    </form>
  );
}
