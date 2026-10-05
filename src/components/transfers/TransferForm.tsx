"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { CreateTransferInput } from "@/app/(dashboard)/stock/transfers/actions";
import type { Product, Store } from "@/types/database.types";

interface CartLine {
  product_id: string;
  name: string;
  sku: string;
  quantity: string;
}

export function TransferForm({
  products,
  stores,
  fixedFromStoreId,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  products: Product[];
  stores: Store[];
  fixedFromStoreId: string | null;
  pending: boolean;
  error?: string;
  onSubmit: (input: CreateTransferInput) => void;
  onCancel: () => void;
}) {
  const [fromStoreId, setFromStoreId] = useState(fixedFromStoreId ?? "");
  const [toStoreId, setToStoreId] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .filter((p) => !lines.some((l) => l.product_id === p.id))
      .slice(0, 8);
  }, [products, search, lines]);

  function addProduct(product: Product) {
    setLines((ls) => [...ls, { product_id: product.id, name: product.name, sku: product.sku, quantity: "1" }]);
    setSearch("");
  }

  function updateLine(productId: string, quantity: string) {
    setLines((ls) => ls.map((l) => (l.product_id === productId ? { ...l, quantity } : l)));
  }

  function removeLine(productId: string) {
    setLines((ls) => ls.filter((l) => l.product_id !== productId));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      from_store_id: fromStoreId,
      to_store_id: toStoreId,
      notes: notes || undefined,
      items: lines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="from_store_id">Magasin source</Label>
          {fixedFromStoreId ? (
            <Input value={stores.find((s) => s.id === fixedFromStoreId)?.name ?? ""} disabled />
          ) : (
            <Select id="from_store_id" required value={fromStoreId} onChange={(e) => setFromStoreId(e.target.value)}>
              <option value="">Sélectionner un magasin</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <Label htmlFor="to_store_id">Magasin destinataire</Label>
          <Select id="to_store_id" required value={toStoreId} onChange={(e) => setToStoreId(e.target.value)}>
            <option value="">Sélectionner un magasin</option>
            {stores
              .filter((store) => store.id !== fromStoreId)
              .map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="product_search">Ajouter des produits</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="product_search"
            placeholder="Rechercher par nom ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {filteredProducts.length > 0 && (
          <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-card">
            {filteredProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => addProduct(product)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"
              >
                <span className="font-medium text-slate-900">{product.name}</span>
                <span className="text-xs text-slate-400">{product.sku}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
            Aucun produit ajouté. Recherchez un produit ci-dessus pour commencer.
          </p>
        ) : (
          lines.map((line) => (
            <div key={line.product_id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{line.name}</p>
                <p className="text-xs text-slate-400">{line.sku}</p>
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  placeholder="Qté"
                  required
                  value={line.quantity}
                  onChange={(e) => updateLine(line.product_id, e.target.value)}
                />
              </div>
              <button type="button" onClick={() => removeLine(line.product_id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
          ))
        )}
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending || lines.length === 0 || !fromStoreId || !toStoreId}>
          {pending ? "Création..." : `Lancer le transfert (${lines.length} produit${lines.length > 1 ? "s" : ""})`}
        </Button>
      </div>
    </form>
  );
}
