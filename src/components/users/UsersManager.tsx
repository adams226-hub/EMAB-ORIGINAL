"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { Profile, Store } from "@/types/database.types";
import { UserForm, type UserFormValues } from "./UserForm";
import { createUser, updateUser, deleteUser, toggleUserActive } from "@/app/(dashboard)/users/actions";

export interface UserRow extends Profile {
  store_name: string | null;
}

export function UsersManager({
  users,
  stores,
  currentUserId,
}: {
  users: UserRow[];
  stores: Store[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [error, setError] = useState<string | undefined>();

  function openCreate() {
    setEditing(null);
    setError(undefined);
    setModalOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditing(user);
    setError(undefined);
    setModalOpen(true);
  }

  function handleSubmit(values: UserFormValues) {
    startTransition(async () => {
      const result = editing
        ? await updateUser(editing.id, {
            full_name: values.full_name,
            role: values.role,
            store_id: values.store_id,
          })
        : await createUser(values);

      if (result.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleDelete(user: UserRow) {
    if (!confirm(`Supprimer le compte de "${user.full_name}" ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      const result = await deleteUser(user.id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  function handleToggle(user: UserRow) {
    startTransition(async () => {
      await toggleUserActive(user.id, !user.is_active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Utilisateurs</h1>
          <p className="mt-1 text-sm text-slate-500">{users.length} compte(s) créé(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Aucun utilisateur"
          description="Créez des comptes pour votre équipe et assignez-leur un rôle et un magasin."
          action={
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Créer un utilisateur
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Utilisateur</TH>
              <TH>Rôle</TH>
              <TH>Magasin</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((user) => (
              <TR key={user.id}>
                <TD>
                  <div className="font-medium text-slate-900">{user.full_name}</div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                </TD>
                <TD>
                  <Badge tone="brand">{ROLE_LABELS[user.role]}</Badge>
                </TD>
                <TD>{user.store_name ?? (user.role === "super_admin" ? "Tous les magasins" : "—")}</TD>
                <TD>
                  <button onClick={() => handleToggle(user)} disabled={user.id === currentUserId}>
                    <Badge tone={user.is_active ? "success" : "default"}>
                      {user.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </button>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {user.id !== currentUserId && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(user)}>
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
        title={editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
      >
        <UserForm
          initial={editing}
          stores={stores}
          pending={isPending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
