"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import type { Customer } from "@/types/database.types";
import { CustomerForm } from "./CustomerForm";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  toggleCustomerActive,
  type CustomerInput,
} from "@/app/(dashboard)/customers/actions";

export function CustomersManager({ customers, canDelete }: { customers: Customer[]; canDelete: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [error, setError] = useState<string | undefined>();

  function openCreate() {
    setEditing(null);
    setError(undefined);
    setModalOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setError(undefined);
    setModalOpen(true);
  }

  function handleSubmit(input: CustomerInput) {
    startTransition(async () => {
      const result = editing ? await updateCustomer(editing.id, input) : await createCustomer(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleDelete(customer: Customer) {
    if (!confirm(`Supprimer le client "${customer.name}" ?`)) return;
    startTransition(async () => {
      const result = await deleteCustomer(customer.id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  function handleToggle(customer: Customer) {
    startTransition(async () => {
      await toggleCustomerActive(customer.id, !customer.is_active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">{customers.length} client(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau client
        </Button>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Aucun client"
          description="Ajoutez vos clients pour suivre leurs achats et leurs créances."
          action={
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Créer un client
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH>Téléphone</TH>
              <TH>Limite de crédit</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {customers.map((customer) => (
              <TR key={customer.id}>
                <TD className="font-medium text-slate-900">{customer.name}</TD>
                <TD>{customer.phone ?? "—"}</TD>
                <TD>{formatCurrency(customer.credit_limit)}</TD>
                <TD>
                  <button onClick={() => handleToggle(customer)}>
                    <Badge tone={customer.is_active ? "success" : "default"}>
                      {customer.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </button>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(customer)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(customer)}>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier le client" : "Nouveau client"}>
        <CustomerForm initial={editing} pending={isPending} error={error} onSubmit={handleSubmit} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
