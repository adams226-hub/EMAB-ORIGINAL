"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { ROLE_LABELS, CREATABLE_ROLES } from "@/lib/auth/permissions";
import type { Profile, Store, UserRole } from "@/types/database.types";

export interface UserFormValues {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  store_id: string;
}

export function UserForm({
  initial,
  stores,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Profile | null;
  stores: Store[];
  pending: boolean;
  error?: string;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<UserFormValues>({
    full_name: initial?.full_name ?? "",
    email: initial?.email ?? "",
    password: "",
    role: initial?.role ?? "manager",
    store_id: initial?.store_id ?? "",
  });

  const needsStore = values.role !== "super_admin";

  const availableRoles =
    initial && !CREATABLE_ROLES.includes(initial.role) ? [initial.role, ...CREATABLE_ROLES] : CREATABLE_ROLES;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div>
        <Label htmlFor="full_name">Nom complet</Label>
        <Input
          id="full_name"
          required
          value={values.full_name}
          onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          disabled={Boolean(initial)}
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        />
      </div>

      {!initial && (
        <div>
          <Label htmlFor="password">Mot de passe temporaire</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={values.password}
            onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
            placeholder="8 caractères minimum"
          />
        </div>
      )}

      <div>
        <Label htmlFor="role">Rôle</Label>
        <Select
          id="role"
          value={values.role}
          onChange={(e) => setValues((v) => ({ ...v, role: e.target.value as UserRole }))}
        >
          {availableRoles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </div>

      {needsStore && (
        <div>
          <Label htmlFor="store">Magasin assigné</Label>
          <Select
            id="store"
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

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : initial ? "Enregistrer" : "Créer le compte"}
        </Button>
      </div>
    </form>
  );
}
