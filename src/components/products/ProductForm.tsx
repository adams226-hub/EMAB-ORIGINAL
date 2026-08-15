"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { Category, Product, Store } from "@/types/database.types";
import type { ProductInput } from "@/app/(dashboard)/products/actions";

export function ProductForm({
  initial,
  categories,
  stores,
  showInitialStock,
  showStoreStocks,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Product | null;
  categories: Category[];
  stores?: Store[];
  showInitialStock: boolean;
  showStoreStocks?: boolean;
  pending: boolean;
  error?: string;
  onSubmit: (input: ProductInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ProductInput>({
    name: initial?.name ?? "",
    sku: initial?.sku ?? "",
    category_id: initial?.category_id ?? "",
    unit: initial?.unit ?? "pièce",
    purchase_price: initial?.purchase_price ?? 0,
    sale_price: initial?.sale_price ?? 0,
    wholesale_price: initial?.wholesale_price ?? null,
    description: initial?.description ?? "",
    initial_quantity: 0,
  });
  const [storeStocks, setStoreStocks] = useState<Record<string, number>>(
    Object.fromEntries((stores ?? []).map((s) => [s.id, 0]))
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (showStoreStocks) {
      const initial_stocks = Object.entries(storeStocks)
        .filter(([, quantity]) => quantity > 0)
        .map(([store_id, quantity]) => ({ store_id, quantity }));
      onSubmit({ ...values, initial_stocks });
      return;
    }
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Nom du produit</Label>
          <Input
            id="name"
            required
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="Riz parfumé 25kg"
          />
        </div>

        <div>
          <Label htmlFor="sku">SKU / Référence</Label>
          <Input
            id="sku"
            required
            value={values.sku}
            onChange={(e) => setValues((v) => ({ ...v, sku: e.target.value }))}
            placeholder="RIZ-25KG"
          />
        </div>

        <div>
          <Label htmlFor="category">Catégorie</Label>
          <Select
            id="category"
            value={values.category_id ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, category_id: e.target.value }))}
          >
            <option value="">Sans catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="unit">Unité</Label>
          <Input
            id="unit"
            value={values.unit}
            onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
            placeholder="pièce, kg, litre..."
          />
        </div>

        <div>
          <Label htmlFor="purchase_price">Prix d'achat</Label>
          <Input
            id="purchase_price"
            type="number"
            min={0}
            step="0.01"
            value={values.purchase_price}
            onChange={(e) => setValues((v) => ({ ...v, purchase_price: Number(e.target.value) }))}
          />
        </div>

        <div>
          <Label htmlFor="sale_price">Prix de vente (détail)</Label>
          <Input
            id="sale_price"
            type="number"
            min={0}
            step="0.01"
            required
            value={values.sale_price}
            onChange={(e) => setValues((v) => ({ ...v, sale_price: Number(e.target.value) }))}
          />
        </div>

        <div>
          <Label htmlFor="wholesale_price">Prix de gros (optionnel)</Label>
          <Input
            id="wholesale_price"
            type="number"
            min={0}
            step="0.01"
            placeholder="Laisser vide si pas de vente en gros"
            value={values.wholesale_price ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, wholesale_price: e.target.value === "" ? null : Number(e.target.value) }))
            }
          />
        </div>

        {showInitialStock && (
          <div>
            <Label htmlFor="initial_quantity">Stock initial (votre magasin)</Label>
            <Input
              id="initial_quantity"
              type="number"
              min={0}
              value={values.initial_quantity}
              onChange={(e) => setValues((v) => ({ ...v, initial_quantity: Number(e.target.value) }))}
            />
          </div>
        )}

        {showStoreStocks && (
          <div className="col-span-2">
            <Label>Stock initial par magasin</Label>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
              {(stores ?? []).map((store) => (
                <div key={store.id}>
                  <Label htmlFor={`store-stock-${store.id}`} className="font-normal text-slate-500">
                    {store.name}
                  </Label>
                  <Input
                    id={`store-stock-${store.id}`}
                    type="number"
                    min={0}
                    value={storeStocks[store.id] ?? 0}
                    onChange={(e) =>
                      setStoreStocks((s) => ({ ...s, [store.id]: Number(e.target.value) }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={values.description ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : initial ? "Enregistrer" : "Créer le produit"}
        </Button>
      </div>
    </form>
  );
}
