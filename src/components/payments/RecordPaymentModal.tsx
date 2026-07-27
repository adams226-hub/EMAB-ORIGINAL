"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { formatCurrency } from "@/lib/utils";
import type { PaymentMethod, PaymentType } from "@/types/database.types";
import { recordPayment } from "@/lib/payments/actions";

export function RecordPaymentModal({
  open,
  onClose,
  type,
  referenceId,
  amountDue,
  paymentMethods,
}: {
  open: boolean;
  onClose: () => void;
  type: PaymentType;
  referenceId: string;
  amountDue: number;
  paymentMethods: PaymentMethod[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(amountDue));
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordPayment({
        type,
        reference_id: referenceId,
        amount: Number(amount),
        payment_method_id: paymentMethodId,
        notes: notes || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Enregistrer un paiement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        <p className="text-sm text-slate-500">
          Solde dû : <span className="font-medium text-slate-900">{formatCurrency(amountDue)}</span>
        </p>

        <div>
          <Label htmlFor="amount">Montant payé</Label>
          <Input
            id="amount"
            type="number"
            min={0.01}
            max={amountDue}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="payment_method_id">Mode de paiement</Label>
          <Select id="payment_method_id" required value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Enregistrement..." : "Enregistrer le paiement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
