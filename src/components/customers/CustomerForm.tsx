"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { Customer } from "@/types/database.types";
import type { CustomerInput } from "@/app/(dashboard)/customers/actions";

export function CustomerForm({
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Customer | null;
  pending: boolean;
  error?: string;
  onSubmit: (input: CustomerInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CustomerInput>({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
    credit_limit: initial?.credit_limit ?? 0,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div>
        <Label htmlFor="name">Nom du client</Label>
        <Input
          id="name"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" value={values.phone ?? ""} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="credit_limit">Limite de crédit</Label>
          <Input
            id="credit_limit"
            type="number"
            min={0}
            step="0.01"
            value={values.credit_limit}
            onChange={(e) => setValues((v) => ({ ...v, credit_limit: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={values.email ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="address">Adresse</Label>
        <Input
          id="address"
          value={values.address ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : initial ? "Enregistrer" : "Créer le client"}
        </Button>
      </div>
    </form>
  );
}
