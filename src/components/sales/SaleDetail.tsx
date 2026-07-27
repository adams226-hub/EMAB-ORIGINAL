"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, Ban, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentMethod, SaleDetail as SaleDetailType } from "@/types/database.types";
import { cancelSale } from "@/app/(dashboard)/sales/actions";

export interface SaleItemRow {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
}

export interface SalePaymentRow {
  id: string;
  amount: number;
  payment_method_name: string;
  payment_date: string;
  paid_by_name: string | null;
}

export function SaleDetail({
  sale,
  items,
  payments,
  paymentMethods,
  canCancel,
  canRecordPayment,
}: {
  sale: SaleDetailType;
  items: SaleItemRow[];
  payments: SalePaymentRow[];
  paymentMethods: PaymentMethod[];
  canCancel: boolean;
  canRecordPayment: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  function handleCancel() {
    const reason = prompt("Motif de l'annulation ?");
    if (reason === null) return;
    startTransition(async () => {
      const result = await cancelSale(sale.id, reason);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{sale.reference}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {sale.store_name} · {formatDate(sale.sale_date)} · {sale.customer_name ?? "Client de passage"}
          </p>
        </div>
        <PaymentStatusBadge status={sale.payment_status} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/sales/${sale.id}/receipt`} target="_blank">
          <Button variant="secondary">
            <Printer className="h-4 w-4" />
            Imprimer le ticket
          </Button>
        </Link>
        {canRecordPayment && sale.amount_due > 0 && sale.status === "completed" && (
          <Button onClick={() => setPaymentModalOpen(true)}>
            <CreditCard className="h-4 w-4" />
            Enregistrer un paiement
          </Button>
        )}
        {canCancel && sale.status === "completed" && (
          <Button variant="secondary" onClick={handleCancel} disabled={isPending}>
            <Ban className="h-4 w-4" />
            Annuler la vente
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Produits ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Produit</TH>
                  <TH>Qté</TH>
                  <TH>Prix unit.</TH>
                  <TH>Remise</TH>
                  <TH>Total</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <div className="font-medium text-slate-900">{item.product_name}</div>
                      <div className="text-xs text-slate-400">{item.sku}</div>
                    </TD>
                    <TD>{item.quantity}</TD>
                    <TD>{formatCurrency(item.unit_price)}</TD>
                    <TD>{item.discount_percent > 0 ? `${item.discount_percent}%` : "—"}</TD>
                    <TD className="font-medium">{formatCurrency(item.line_total)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Résumé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Sous-total</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Remise globale</span>
              <span>{sale.discount_percent}%</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(sale.total_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-500">Payé</span>
              <span>{formatCurrency(sale.amount_paid)}</span>
            </div>
            <div className="flex justify-between font-medium text-amber-600">
              <span>Solde dû</span>
              <span>{formatCurrency(sale.amount_due)}</span>
            </div>

            {payments.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 font-medium text-slate-700">Historique des paiements</p>
                <ul className="space-y-1.5">
                  {payments.map((p) => (
                    <li key={p.id} className="flex justify-between text-slate-500">
                      <span>
                        {formatDate(p.payment_date)} · {p.payment_method_name}
                      </span>
                      <span className="font-medium text-slate-900">{formatCurrency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RecordPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        type="sale_payment"
        referenceId={sale.id}
        amountDue={sale.amount_due}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
