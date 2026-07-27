"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { ManualMovementInput } from "@/app/(dashboard)/stock/actions";
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
  onSubmit: (input: ManualMovementInput) => void;
  onCancel: () => void;
}) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [values, setValues] = useState({
    product_id: "",
    store_id: fixedStoreId ?? "",
    quantity: "",
    unit_cost: "",
    reason: kind === "out" ? OUT_REASONS[0].value : kind === "adjustment" ? ADJUSTMENT_REASONS[0].value : "",
    notes: "",
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const type: ManualMovementInput["type"] =
      kind === "in" ? "in" : kind === "out" ? "out" : direction === "in" ? "adjustment_in" : "adjustment_out";

    onSubmit({
      type,
      product_id: values.product_id,
      store_id: values.store_id,
      quantity: Number(values.quantity),
      unit_cost: values.unit_cost ? Number(values.unit_cost) : undefined,
      reason: values.reason || undefined,
      notes: values.notes || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      {!fixedStoreId && (
        <div>
          <Label htmlFor="store_id">Magasin</Label>
          <Select
            id="store_id"
            required
            value={values.store_id}
            onChange={(e) => setValues((v) => ({ ...v, store_id: e.target.value }))}
          >
            <option value="">Sélectionner un magasin</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="product_id">Produit</Label>
        <Select
          id="product_id"
          required
          value={values.product_id}
          onChange={(e) => setValues((v) => ({ ...v, product_id: e.target.value }))}
        >
          <option value="">Sélectionner un produit</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.sku})
            </option>
          ))}
        </Select>
      </div>

      {kind === "adjustment" && (
        <div>
          <Label htmlFor="direction">Sens de l'ajustement</Label>
          <Select id="direction" value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")}>
            <option value="in">Augmentation (+)</option>
            <option value="out">Diminution (-)</option>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quantity">Quantité</Label>
          <Input
            id="quantity"
            type="number"
            min={0.01}
            step="0.01"
            required
            value={values.quantity}
            onChange={(e) => setValues((v) => ({ ...v, quantity: e.target.value }))}
          />
        </div>

        {kind === "in" && (
          <div>
            <Label htmlFor="unit_cost">Prix d'achat unitaire</Label>
            <Input
              id="unit_cost"
              type="number"
              min={0}
              step="0.01"
              value={values.unit_cost}
              onChange={(e) => setValues((v) => ({ ...v, unit_cost: e.target.value }))}
            />
          </div>
        )}
      </div>

      {(kind === "out" || kind === "adjustment") && (
        <div>
          <Label htmlFor="reason">Motif</Label>
          <Select
            id="reason"
            value={values.reason}
            onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))}
          >
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
        <Textarea id="notes" value={values.notes} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Valider"}
        </Button>
      </div>
    </form>
  );
}
