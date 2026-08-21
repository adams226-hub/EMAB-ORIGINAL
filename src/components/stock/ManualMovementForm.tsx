"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { ManualMovementsBulkInput } from "@/app/(dashboard)/stock/actions";
import type { Product, Store } from "@/types/database.types";

export type ManualMovementKind = "in" | "out" | "adjustment";

const OUT_REASONS = [
  { value: "perte", label: "Perte" },
  { value: "casse", label: "Casse / dommage" },
  { value: "usage_interne", label: "Usage interne" },
  { value: "echantillon", label: "Échantillon offert" },
  { value: "autre", label: "Autre" },
];

const ADJUSTMENT_REASONS = [
  { value: "erreur_saisie", label: "Erreur de saisie" },
  { value: "peremption", label: "Péremption" },
  { value: "vol", label: "Vol / disparition" },
  { value: "autre", label: "Autre" },
];

interface CartLine {
  product_id: string;
  name: string;
  sku: string;
  quantity: string;
  unit_cost: string;
}

export function ManualMovementForm({
  kind,
  products,
  stores,
  fixedStoreId,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  kind: ManualMovementKind;
  products: Product[];
  stores: Store[];
  fixedStoreId: string | null;
  pending: boolean;
  error?: string;
  onSubmit: (input: ManualMovementsBulkInput) => void;
  onCancel: () => void;
}) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [storeId, setStoreId] = useState(fixedStoreId ?? "");
  const [reason, setReason] = useState(
    kind === "out" ? OUT_REASONS[0].value : kind === "adjustment" ? ADJUSTMENT_REASONS[0].value : ""
  );
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
    setLines((ls) => [
      ...ls,
      { product_id: product.id, name: product.name, sku: product.sku, quantity: "1", unit_cost: "" },
    ]);
    setSearch("");
  }

  function updateLine(productId: string, field: "quantity" | "unit_cost", value: string) {
    setLines((ls) => ls.map((l) => (l.product_id === productId ? { ...l, [field]: value } : l)));
  }

  function removeLine(productId: string) {
    setLines((ls) => ls.filter((l) => l.product_id !== productId));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const type: ManualMovementsBulkInput["type"] =
      kind === "in" ? "in" : kind === "out" ? "out" : direction === "in" ? "adjustment_in" : "adjustment_out";

    onSubmit({
      type,
      store_id: storeId,
      reason: reason || undefined,
      notes: notes || undefined,
      items: lines.map((l) => ({
        product_id: l.product_id,
        quantity: Number(l.quantity),
        unit_cost: kind === "in" && l.unit_cost ? Number(l.unit_cost) : undefined,
      })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      {!fixedStoreId && (
        <div>
          <Label htmlFor="store_id">Magasin</Label>
          <Select id="store_id" required value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Sélectionner un magasin</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {kind === "adjustment" && (
        <div>
          <Label htmlFor="direction">Sens de l'ajustement</Label>
          <Select id="direction" value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")}>
            <option value="in">Augmentation (+)</option>
            <option value="out">Diminution (-)</option>
          </Select>
        </div>
      )}

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
                  onChange={(e) => updateLine(line.product_id, "quantity", e.target.value)}
                />
              </div>
              {kind === "in" && (
                <div className="w-28">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Prix achat"
                    value={line.unit_cost}
                    onChange={(e) => updateLine(line.product_id, "unit_cost", e.target.value)}
                  />
                </div>
              )}
              <button type="button" onClick={() => removeLine(line.product_id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
          ))
        )}
      </div>

      {(kind === "out" || kind === "adjustment") && (
        <div>
          <Label htmlFor="reason">Motif</Label>
          <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {(kind === "out" ? OUT_REASONS : ADJUSTMENT_REASONS).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending || lines.length === 0}>
          {pending ? "Enregistrement..." : `Valider (${lines.length} produit${lines.length > 1 ? "s" : ""})`}
        </Button>
      </div>
    </form>
  );
}
