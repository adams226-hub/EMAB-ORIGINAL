"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Store } from "@/types/database.types";
import { StoreForm } from "./StoreForm";
import { createStore, updateStore, deleteStore, toggleStoreActive, type StoreInput } from "@/app/(dashboard)/stores/actions";

export function StoresManager({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [error, setError] = useState<string | undefined>();

  function openCreate() {
    setEditing(null);
    setError(undefined);
    setModalOpen(true);
  }

  function openEdit(store: Store) {
    setEditing(store);
    setError(undefined);
    setModalOpen(true);
  }

  function handleSubmit(input: StoreInput) {
    startTransition(async () => {
      const result = editing ? await updateStore(editing.id, input) : await createStore(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleDelete(store: Store) {
    if (!confirm(`Supprimer le magasin "${store.name}" ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      const result = await deleteStore(store.id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  function handleToggle(store: Store) {
    startTransition(async () => {
      await toggleStoreActive(store.id, !store.is_active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Magasins</h1>
          <p className="mt-1 text-sm text-slate-500">{stores.length} magasin(s) enregistré(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau magasin
        </Button>
      </div>

      {stores.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title="Aucun magasin"
          description="Ajoutez votre premier magasin pour commencer à organiser votre réseau."
          action={
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Créer un magasin
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Magasin</TH>
              <TH>Code</TH>
              <TH>Ville</TH>
              <TH>Téléphone</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {stores.map((store) => (
              <TR key={store.id}>
                <TD className="font-medium text-slate-900">{store.name}</TD>
                <TD>{store.code}</TD>
                <TD>{store.city ?? "—"}</TD>
                <TD>{store.phone ?? "—"}</TD>
                <TD>
                  <button onClick={() => handleToggle(store)}>
                    <Badge tone={store.is_active ? "success" : "default"}>
                      {store.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </button>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(store)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(store)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier le magasin" : "Nouveau magasin"}>
        <StoreForm
          initial={editing}
          pending={isPending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
