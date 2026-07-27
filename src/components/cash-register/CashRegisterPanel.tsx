"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { FormError } from "@/components/ui/FormError";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CashSession } from "@/types/database.types";
import { openCashSession, closeCashSession, addCashAdjustment } from "@/app/(dashboard)/cash-register/actions";

export interface JournalRow {
  id: string;
  type: "sale_payment" | "expense" | "adjustment_in" | "adjustment_out";
  label: string;
  amount: number;
  date: string;
}

export function CashRegisterPanel({
  storeId,
  session,
  journal,
  runningTotal,
}: {
  storeId: string;
  session: CashSession | null;
  journal: JournalRow[];
  runningTotal: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closingAmount, setClosingAmount] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<"in" | "out">("out");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  function handleOpen(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await openCashSession(storeId, Number(openingAmount));
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      router.refresh();
    });
  }

  function handleClose(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    startTransition(async () => {
      const result = await closeCashSession(session.id, Number(closingAmount), closeNotes);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCloseModalOpen(false);
      setError(undefined);
      router.refresh();
    });
  }

  function handleAdjust(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    startTransition(async () => {
      const result = await addCashAdjustment({
        cash_session_id: session.id,
        type: adjustType,
        amount: Number(adjustAmount),
        reason: adjustReason,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setAdjustModalOpen(false);
      setAdjustAmount("");
      setAdjustReason("");
      setError(undefined);
      router.refresh();
    });
  }

  if (!session) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Ouvrir la caisse</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOpen} className="space-y-4">
            <FormError message={error} />
            <div>
              <Label htmlFor="opening_amount">Fonds de caisse initial</Label>
              <Input
                id="opening_amount"
                type="number"
                min={0}
                step="0.01"
                required
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              <LockOpen className="h-4 w-4" />
              Ouvrir la caisse
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Badge tone="success">Caisse ouverte</Badge>
          <p className="mt-1 text-sm text-slate-500">
            Depuis le {formatDate(session.opened_at)} — fonds initial {formatCurrency(session.opening_amount)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAdjustModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Mouvement de caisse
          </Button>
          <Button variant="secondary" onClick={() => setCloseModalOpen(true)}>
            <Lock className="h-4 w-4" />
            Fermer la caisse
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solde théorique actuel : {formatCurrency(runningTotal)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Opération</TH>
                <TH className="text-right">Montant</TH>
              </TR>
            </THead>
            <TBody>
              {journal.map((row) => (
                <TR key={row.id}>
                  <TD className="text-sm text-slate-500">{formatDate(row.date)}</TD>
                  <TD>{row.label}</TD>
                  <TD className={row.amount >= 0 ? "text-right text-emerald-600" : "text-right text-red-600"}>
                    {row.amount >= 0 ? "+" : ""}
                    {formatCurrency(row.amount)}
                  </TD>
                </TR>
              ))}
              {journal.length === 0 && (
                <TR>
                  <TD colSpan={3} className="text-center text-sm text-slate-400">
                    Aucun mouvement depuis l&apos;ouverture
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={closeModalOpen} onClose={() => setCloseModalOpen(false)} title="Fermer la caisse">
        <form onSubmit={handleClose} className="space-y-4">
          <FormError message={error} />
          <p className="text-sm text-slate-500">
            Comptez les espèces présentes dans le tiroir-caisse et saisissez le montant réel.
          </p>
          <div>
            <Label htmlFor="closing_amount">Montant compté</Label>
            <Input
              id="closing_amount"
              type="number"
              min={0}
              step="0.01"
              required
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="close_notes">Notes</Label>
            <Textarea id="close_notes" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCloseModalOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Fermeture..." : "Confirmer la fermeture"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title="Mouvement de caisse manuel">
        <form onSubmit={handleAdjust} className="space-y-4">
          <FormError message={error} />
          <div className="flex gap-2">
            <Button
              type="button"
              variant={adjustType === "in" ? "primary" : "secondary"}
              className="flex-1"
              onClick={() => setAdjustType("in")}
            >
              <Plus className="h-4 w-4" />
              Entrée
            </Button>
            <Button
              type="button"
              variant={adjustType === "out" ? "primary" : "secondary"}
              className="flex-1"
              onClick={() => setAdjustType("out")}
            >
              <Minus className="h-4 w-4" />
              Sortie
            </Button>
          </div>
          <div>
            <Label htmlFor="adjust_amount">Montant</Label>
            <Input
              id="adjust_amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="adjust_reason">Motif</Label>
            <Textarea id="adjust_reason" required value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Dépôt bancaire, appoint monnaie..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAdjustModalOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
