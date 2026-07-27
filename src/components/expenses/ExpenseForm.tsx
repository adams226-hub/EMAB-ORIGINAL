"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { ExpenseCategory, PaymentMethod, Store } from "@/types/database.types";
import type { ExpenseInput } from "@/app/(dashboard)/expenses/actions";

export function ExpenseForm({
  categories,
  paymentMethods,
  stores,
  fixedStoreId,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  categories: ExpenseCategory[];
  paymentMethods: PaymentMethod[];
  stores: Store[];
  fixedStoreId: string | null;
  pending: boolean;
  error?: string;
  onSubmit: (input: ExpenseInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ExpenseInput>({
    store_id: fixedStoreId ?? "",
    category_id: "",
    payment_method_id: "",
    amount: 0,
    description: "",
    expense_date: new Date().toISOString().slice(0, 10),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      {!fixedStoreId && (
        <div>
          <Label htmlFor="store_id">Magasin</Label>
          <Select id="store_id" required value={values.store_id} onChange={(e) => setValues((v) => ({ ...v, store_id: e.target.value }))}>
            <option value="">Sélectionner</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          required
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          placeholder="Plein d'essence véhicule de livraison"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category_id">Catégorie</Label>
          <Select id="category_id" value={values.category_id ?? ""} onChange={(e) => setValues((v) => ({ ...v, category_id: e.target.value }))}>
            <option value="">Sans catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="amount">Montant</Label>
          <Input
            id="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
            value={values.amount}
            onChange={(e) => setValues((v) => ({ ...v, amount: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label htmlFor="payment_method_id">Mode de paiement</Label>
          <Select
            id="payment_method_id"
            required
            value={values.payment_method_id}
            onChange={(e) => setValues((v) => ({ ...v, payment_method_id: e.target.value }))}
          >
            <option value="">Sélectionner</option>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="expense_date">Date</Label>
          <Input
            id="expense_date"
            type="date"
            value={values.expense_date}
            onChange={(e) => setValues((v) => ({ ...v, expense_date: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer la dépense"}
        </Button>
      </div>
    </form>
  );
}
