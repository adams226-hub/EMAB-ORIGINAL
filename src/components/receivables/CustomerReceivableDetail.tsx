"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database.types";
import { HandCoins } from "lucide-react";

export interface UnpaidSaleRow {
  id: string;
  reference: string;
  sale_date: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
}

export function CustomerReceivableDetail({
  customerName,
  sales,
  paymentMethods,
}: {
  customerName: string;
  sales: UnpaidSaleRow[];
  paymentMethods: PaymentMethod[];
}) {
  const [selectedSale, setSelectedSale] = useState<UnpaidSaleRow | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">{customerName}</h1>

      {sales.length === 0 ? (
        <EmptyState icon={HandCoins} title="Aucune vente impayée" description="Ce client est à jour." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>Date</TH>
              <TH>Total</TH>
              <TH>Payé</TH>
              <TH>Solde dû</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {sales.map((sale) => (
              <TR key={sale.id}>
                <TD>
                  <Link href={`/sales/${sale.id}`} className="font-medium text-brand-600 hover:underline">
                    {sale.reference}
                  </Link>
                </TD>
                <TD className="text-sm text-slate-500">{formatDate(sale.sale_date)}</TD>
                <TD>{formatCurrency(sale.total_amount)}</TD>
                <TD>{formatCurrency(sale.amount_paid)}</TD>
                <TD className="font-medium text-amber-600">{formatCurrency(sale.amount_due)}</TD>
                <TD className="text-right">
                  <Button size="sm" onClick={() => setSelectedSale(sale)}>
                    <CreditCard className="h-4 w-4" />
                    Encaisser
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {selectedSale && (
        <RecordPaymentModal
          open={Boolean(selectedSale)}
          onClose={() => setSelectedSale(null)}
          type="sale_payment"
          referenceId={selectedSale.id}
          amountDue={selectedSale.amount_due}
          paymentMethods={paymentMethods}
        />
      )}
    </div>
  );
}
