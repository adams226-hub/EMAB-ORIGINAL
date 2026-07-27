"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tags, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExpenseCategory, PaymentMethod, Store } from "@/types/database.types";
import { ExpenseForm } from "./ExpenseForm";
import { ExpenseCategoriesModal } from "./ExpenseCategoriesModal";
import { createExpense, deleteExpense, type ExpenseInput } from "@/app/(dashboard)/expenses/actions";

export interface ExpenseRow {
  id: string;
  store_name: string;
  category_name: string | null;
  payment_method_name: string;
  amount: number;
  description: string;
  expense_date: string;
}

export function ExpensesManager({
  expenses,
  categories,
  paymentMethods,
  stores,
  fixedStoreId,
  canDelete,
}: {
  expenses: ExpenseRow[];
  categories: ExpenseCategory[];
  paymentMethods: PaymentMethod[];
  stores: Store[];
  fixedStoreId: string | null;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  function handleSubmit(input: ExpenseInput) {
    startTransition(async () => {
      const result = await createExpense(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer cette dépense ?")) return;
    startTransition(async () => {
      const result = await deleteExpense(id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dépenses</h1>
          <p className="mt-1 text-sm text-slate-500">
            {expenses.length} dépense(s) — total {formatCurrency(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCategoriesOpen(true)}>
            <Tags className="h-4 w-4" />
            Catégories
          </Button>
          <Button
            onClick={() => {
              setError(undefined);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </Button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={Wallet} title="Aucune dépense" description="Enregistrez vos dépenses (carburant, loyer, salaires...)." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Description</TH>
              <TH>Catégorie</TH>
              <TH>Magasin</TH>
              <TH>Mode de paiement</TH>
              <TH>Montant</TH>
              {canDelete && <TH className="text-right">Actions</TH>}
            </TR>
          </THead>
          <TBody>
            {expenses.map((expense) => (
              <TR key={expense.id}>
                <TD className="whitespace-nowrap text-sm text-slate-500">{formatDate(expense.expense_date)}</TD>
                <TD className="font-medium text-slate-900">{expense.description}</TD>
                <TD>{expense.category_name ?? "—"}</TD>
                <TD>{expense.store_name}</TD>
                <TD>{expense.payment_method_name}</TD>
                <TD className="font-medium">{formatCurrency(expense.amount)}</TD>
                {canDelete && (
                  <TD className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)} disabled={isPending}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle dépense">
        <ExpenseForm
          categories={categories}
          paymentMethods={paymentMethods}
          stores={stores}
          fixedStoreId={fixedStoreId}
          pending={isPending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <ExpenseCategoriesModal open={categoriesOpen} onClose={() => setCategoriesOpen(false)} categories={categories} />
    </div>
  );
}
