"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, PackageCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TransferStatusBadge } from "./TransferStatusBadge";
import { formatDate } from "@/lib/utils";
import type { StockTransfer } from "@/types/database.types";
import { validateTransfer, receiveTransfer, cancelTransfer } from "@/app/(dashboard)/stock/transfers/actions";

export interface TransferItemRow {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
}

export function TransferDetail({
  transfer,
  fromStoreName,
  toStoreName,
  items,
  canAct,
}: {
  transfer: StockTransfer;
  fromStoreName: string;
  toStoreName: string;
  items: TransferItemRow[];
  canAct: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function handleValidate() {
    setError(undefined);
    startTransition(async () => {
      const result = await validateTransfer(transfer.id);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function handleReceive() {
    setError(undefined);
    startTransition(async () => {
      const result = await receiveTransfer(transfer.id);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function handleCancel() {
    if (!confirm("Annuler ce transfert ?")) return;
    setError(undefined);
    startTransition(async () => {
      const result = await cancelTransfer(transfer.id);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/stock/transfers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux transferts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{transfer.reference}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fromStoreName} → {toStoreName} · {formatDate(transfer.created_at)}
          </p>
        </div>
        <TransferStatusBadge status={transfer.status} />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {canAct && (
        <div className="flex flex-wrap gap-2">
          {transfer.status === "pending" && (
            <>
              <Button onClick={handleValidate} disabled={isPending}>
                <Check className="h-4 w-4" />
                Valider (envoyer)
              </Button>
              <Button variant="secondary" onClick={handleCancel} disabled={isPending}>
                <X className="h-4 w-4" />
                Annuler le transfert
              </Button>
            </>
          )}
          {transfer.status === "in_transit" && (
            <Button onClick={handleReceive} disabled={isPending}>
              <PackageCheck className="h-4 w-4" />
              Réceptionner
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Produits ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Produit</TH>
                <TH>Quantité</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((item) => (
                <TR key={item.product_id}>
                  <TD>
                    <div className="font-medium text-slate-900">{item.product_name}</div>
                    <div className="text-xs text-slate-400">{item.sku}</div>
                  </TD>
                  <TD>{item.quantity.toLocaleString("fr-FR")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {transfer.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">{transfer.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
