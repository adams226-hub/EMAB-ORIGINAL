"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { ExpenseCategory } from "@/types/database.types";
import { createExpenseCategory, deleteExpenseCategory } from "@/app/(dashboard)/expenses/actions";

export function ExpenseCategoriesModal({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createExpenseCategory(name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      setError(undefined);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteExpenseCategory(id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Catégories de dépenses">
      <div className="space-y-4">
        <FormError message={error} />
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input placeholder="Nouvelle catégorie" value={name} onChange={(e) => setName(e.target.value)} required />
          <Button type="submit" disabled={isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between px-3 py-2 text-sm">
              {category.name}
              <button onClick={() => handleDelete(category.id)} disabled={isPending}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </li>
          ))}
          {categories.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Aucune catégorie</li>}
        </ul>
      </div>
    </Modal>
  );
}
