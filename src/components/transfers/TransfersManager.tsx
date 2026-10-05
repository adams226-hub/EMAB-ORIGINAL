"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import type { Product, Store, TransferStatus } from "@/types/database.types";
import { TransferStatusBadge } from "./TransferStatusBadge";
import { TransferForm } from "./TransferForm";
import { createStockTransfer, type CreateTransferInput } from "@/app/(dashboard)/stock/transfers/actions";

export interface TransferRow {
  id: string;
  reference: string;
  status: TransferStatus;
  from_store_name: string;
  to_store_name: string;
  created_at: string;
}

export function TransfersManager({
  transfers,
  products,
  stores,
  fixedFromStoreId,
}: {
  transfers: TransferRow[];
  products: Product[];
  stores: Store[];
  fixedFromStoreId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function handleSubmit(input: CreateTransferInput) {
    startTransition(async () => {
      const result = await createStockTransfer(input);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Transferts entre magasins</h1>
          <p className="mt-1 text-sm text-slate-500">{transfers.length} transfert(s)</p>
        </div>
        <Button
          onClick={() => {
            setError(undefined);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nouveau transfert
        </Button>
      </div>

      {transfers.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Aucun transfert"
          description="Lancez un transfert pour déplacer du stock d'un magasin vers un autre."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>De</TH>
              <TH>Vers</TH>
              <TH>Statut</TH>
              <TH>Créé le</TH>
            </TR>
          </THead>
          <TBody>
            {transfers.map((t) => (
              <TR key={t.id}>
                <TD>
                  <Link href={`/stock/transfers/${t.id}`} className="font-medium text-brand-600 hover:underline">
                    {t.reference}
                  </Link>
                </TD>
                <TD>{t.from_store_name}</TD>
                <TD>{t.to_store_name}</TD>
                <TD>
                  <TransferStatusBadge status={t.status} />
                </TD>
                <TD className="text-sm text-slate-500">{formatDate(t.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau transfert">
        <TransferForm
          products={products}
          stores={stores}
          fixedFromStoreId={fixedFromStoreId}
          pending={isPending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
