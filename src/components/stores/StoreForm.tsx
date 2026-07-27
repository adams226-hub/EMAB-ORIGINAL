"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { Store } from "@/types/database.types";
import type { StoreInput } from "@/app/(dashboard)/stores/actions";

export function StoreForm({
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Store | null;
  pending: boolean;
  error?: string;
  onSubmit: (input: StoreInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<StoreInput>({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="name">Nom du magasin</Label>
          <Input
            id="name"
            required
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="EMAB Centre-Ville"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="code">Code magasin</Label>
          <Input
            id="code"
            required
            value={values.code}
            onChange={(e) => setValues((v) => ({ ...v, code: e.target.value.toUpperCase() }))}
            placeholder="ST-004"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="address">Adresse</Label>
          <Input
            id="address"
            value={values.address ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            value={values.city ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            value={values.phone ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={values.email ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : initial ? "Enregistrer" : "Créer le magasin"}
        </Button>
      </div>
    </form>
  );
}
