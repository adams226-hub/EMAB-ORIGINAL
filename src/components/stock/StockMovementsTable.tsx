"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2, History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import type { StockMovementDetail } from "@/types/database.types";
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_TONE } from "./movement-labels";
import { reverseMovement } from "@/app/(dashboard)/stock/actions";

export function StockMovementsTable({
  movements,
  showStore = true,
  reversedIds,
  canReverse = false,
}: {
  movements: StockMovementDetail[];
  showStore?: boolean;
  reversedIds: Set<string>;
  canReverse?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleReverse(id: string) {
    if (!confirm("Annuler ce mouvement ? Un mouvement inverse sera créé (aucune suppression).")) return;
    startTransition(async () => {
      const result = await reverseMovement(id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  if (movements.length === 0) {
    return <EmptyState icon={History} title="Aucun mouvement" description="Aucune opération enregistrée pour le moment." />;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Date</TH>
          <TH>Type</TH>
          <TH>Produit</TH>
          {showStore && <TH>Magasin</TH>}
          <TH>Quantité</TH>
          <TH>Référence</TH>
          <TH>Par</TH>
          {canReverse && <TH className="text-right">Actions</TH>}
        </TR>
      </THead>
      <TBody>
        {movements.map((m) => {
          const isReversed = reversedIds.has(m.id);
          const isReversal = Boolean(m.reversal_of);
          return (
            <TR key={m.id}>
              <TD className="whitespace-nowrap text-sm text-slate-500">{formatDate(m.created_at)}</TD>
              <TD>
                <Badge tone={MOVEMENT_TYPE_TONE[m.type]}>{MOVEMENT_TYPE_LABELS[m.type]}</Badge>
                {isReversal && <span className="ml-1.5 text-xs text-slate-400">(annulation)</span>}
              </TD>
              <TD>
                <div className="font-medium text-slate-900">{m.product_name}</div>
                <div className="text-xs text-slate-400">{m.sku}</div>
              </TD>
              {showStore && <TD>{m.store_name}</TD>}
              <TD className="font-medium">{Number(m.quantity).toLocaleString("fr-FR")}</TD>
              <TD className="text-sm text-slate-500">
                {m.reference ?? m.reason ?? (m.reference_type !== "manual" ? m.reference_type : "—")}
              </TD>
              <TD className="text-sm text-slate-500">{m.created_by_name ?? "—"}</TD>
              {canReverse && (
                <TD className="text-right">
                  {m.reference_type === "manual" && !isReversed && !isReversal && (
                    <Button variant="ghost" size="sm" onClick={() => handleReverse(m.id)} disabled={isPending}>
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                  {isReversed && <span className="text-xs text-slate-400">Annulé</span>}
                </TD>
              )}
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
