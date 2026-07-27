"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Category } from "@/types/database.types";
import { CategoryForm } from "./CategoryForm";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryInput,
} from "@/app/(dashboard)/categories/actions";

export function CategoriesManager({
  categories,
  canDelete,
}: {
  categories: Category[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState<string | undefined>();

  function openCreate() {
    setEditing(null);
    setError(undefined);
    setModalOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setError(undefined);
    setModalOpen(true);
  }

  function handleSubmit(input: CategoryInput) {
    startTransition(async () => {
      const result = editing
        ? await updateCategory(editing.id, input)
        : await createCategory(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleDelete(category: Category) {
    if (!confirm(`Supprimer la catégorie "${category.name}" ?`)) return;
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  function parentName(id: string | null) {
    if (!id) return "—";
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Catégories</h1>
          <p className="mt-1 text-sm text-slate-500">{categories.length} catégorie(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle catégorie
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Aucune catégorie"
          description="Créez des catégories pour organiser votre catalogue produits."
          action={
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Créer une catégorie
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nom</TH>
              <TH>Catégorie parente</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {categories.map((category) => (
              <TR key={category.id}>
                <TD className="font-medium text-slate-900">{category.name}</TD>
                <TD>{parentName(category.parent_id)}</TD>
                <TD>
                  <Badge tone={category.is_active ? "success" : "default"}>
                    {category.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(category)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(category)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier la catégorie" : "Nouvelle catégorie"}
      >
        <CategoryForm
          initial={editing}
          categories={categories}
          pending={isPending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
