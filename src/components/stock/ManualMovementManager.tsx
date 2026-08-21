"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Product, Store, StockMovementDetail } from "@/types/database.types";
import { ManualMovementForm, type ManualMovementKind } from "./ManualMovementForm";
import { StockMovementsTable } from "./StockMovementsTable";
import { StockMovementNav } from "./StockMovementNav";
import { createManualMovementsBulk, type ManualMovementsBulkInput } from "@/app/(dashboard)/stock/actions";

const TITLES: Record<ManualMovementKind, { title: string; cta: string; subtitle: string }> = {
  in: { title: "Entrées de stock", cta: "Nouvelle entrée", subtitle: "Réceptions manuelles de marchandise" },
  out: { title: "Sorties de stock", cta: "Nouvelle sortie", subtitle: "Pertes, casses, usage interne, échantillons" },
  adjustment: { title: "Ajustements de stock", cta: "Nouvel ajustement", subtitle: "Corrections ponctuelles hors inventaire" },
};

export function ManualMovementManager({
  kind,
  movements,
  products,
  stores,
  fixedStoreId,
  canReverse,
}: {
  kind: ManualMovementKind;
  movements: StockMovementDetail[];
  products: Product[];
  stores: Store[];
  fixedStoreId: string | null;
  canReverse: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const copy = TITLES[kind];

  const reversedIds = new Set(movements.filter((m) => m.reversal_of).map((m) => m.reversal_of as string));

  function handleSubmit(input: ManualMovementsBulkInput) {
    startTransition(async () => {
      const result = await createManualMovementsBulk(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {kind !== "adjustment" && <StockMovementNav />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
        </div>
        <Button
          onClick={() => {
            setError(undefined);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {copy.cta}
        </Button>
      </div>

      <StockMovementsTable
        movements={movements}
        showStore={!fixedStoreId}
        reversedIds={reversedIds}
        canReverse={canReverse}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={copy.cta}>
        <ManualMovementForm
          kind={kind}
          products={products}
          stores={stores}
          fixedStoreId={fixedStoreId}
          pending={isPending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
