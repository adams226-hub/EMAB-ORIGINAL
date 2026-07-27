"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { Category } from "@/types/database.types";
import type { CategoryInput } from "@/app/(dashboard)/categories/actions";

export function CategoryForm({
  initial,
  categories,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Category | null;
  categories: Category[];
  pending: boolean;
  error?: string;
  onSubmit: (input: CategoryInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CategoryInput>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    parent_id: initial?.parent_id ?? "",
  });

  const parentOptions = categories.filter((c) => c.id !== initial?.id);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div>
        <Label htmlFor="name">Nom de la catégorie</Label>
        <Input
          id="name"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="Alimentation"
        />
      </div>

      <div>
        <Label htmlFor="parent">Catégorie parente (optionnel)</Label>
        <Select
          id="parent"
          value={values.parent_id ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, parent_id: e.target.value }))}
        >
          <option value="">Aucune (catégorie principale)</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={values.description ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : initial ? "Enregistrer" : "Créer la catégorie"}
        </Button>
      </div>
    </form>
  );
}
