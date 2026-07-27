"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { FormError } from "@/components/ui/FormError";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PaymentMethod } from "@/types/database.types";
import {
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  togglePaymentMethodActive,
  type PaymentMethodInput,
} from "@/app/(dashboard)/payment-methods/actions";

export function PaymentMethodsManager({ methods, canDelete }: { methods: PaymentMethod[]; canDelete: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [values, setValues] = useState<PaymentMethodInput>({ name: "", is_cash: false });

  function openCreate() {
    setEditing(null);
    setValues({ name: "", is_cash: false });
    setError(undefined);
    setModalOpen(true);
  }

  function openEdit(method: PaymentMethod) {
    setEditing(method);
    setValues({ name: method.name, is_cash: method.is_cash });
    setError(undefined);
    setModalOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = editing ? await updatePaymentMethod(editing.id, values) : await createPaymentMethod(values);
      if (result.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleDelete(method: PaymentMethod) {
    if (!confirm(`Supprimer le mode de paiement "${method.name}" ?`)) return;
    startTransition(async () => {
      const result = await deletePaymentMethod(method.id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  function handleToggle(method: PaymentMethod) {
    startTransition(async () => {
      await togglePaymentMethodActive(method.id, !method.is_active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Modes de paiement</h1>
          <p className="mt-1 text-sm text-slate-500">{methods.length} mode(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau mode
        </Button>
      </div>

      {methods.length === 0 ? (
        <EmptyState icon={Landmark} title="Aucun mode de paiement" description="Ajoutez vos moyens d'encaissement (espèces, mobile money...)." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nom</TH>
              <TH>Caisse physique</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {methods.map((method) => (
              <TR key={method.id}>
                <TD className="font-medium text-slate-900">{method.name}</TD>
                <TD>
                  {method.is_cash ? <Badge tone="brand">Espèces</Badge> : <span className="text-slate-400">—</span>}
                </TD>
                <TD>
                  <button onClick={() => handleToggle(method)}>
                    <Badge tone={method.is_active ? "success" : "default"}>{method.is_active ? "Actif" : "Inactif"}</Badge>
                  </button>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(method)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(method)}>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier le mode de paiement" : "Nouveau mode de paiement"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormError message={error} />
          <div>
            <Label htmlFor="name">Nom</Label>
            <Input id="name" required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} placeholder="Mobile Money" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={values.is_cash}
              onChange={(e) => setValues((v) => ({ ...v, is_cash: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Ce mode alimente la caisse physique (réconciliation d&apos;espèces)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement..." : editing ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
