"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { upsertProductStock } from "@/app/(dashboard)/products/actions";
import type { Store } from "@/types/database.types";

export interface StoreStockRow {
  store: Store;
  quantity: number;
  alert_threshold: number;
  editable: boolean;
}

export function StockTable({ productId, rows }: { productId: string; rows: StoreStockRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, { quantity: number; alert_threshold: number }>>(
    Object.fromEntries(
      rows.map((r) => [r.store.id, { quantity: r.quantity, alert_threshold: r.alert_threshold }])
    )
  );
  const [savedId, setSavedId] = useState<string | null>(null);

  function handleSave(storeId: string) {
    const values = draft[storeId];
    startTransition(async () => {
      const result = await upsertProductStock(productId, {
        store_id: storeId,
        quantity: values.quantity,
        alert_threshold: values.alert_threshold,
      });
      if (result.error) {
        alert(result.error);
        return;
      }
      setSavedId(storeId);
      router.refresh();
      setTimeout(() => setSavedId(null), 1500);
    });
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Magasin</TH>
          <TH>Quantité</TH>
          <TH>Seuil d'alerte</TH>
          <TH>Statut</TH>
          <TH className="text-right">Actions</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map(({ store, editable }) => {
          const values = draft[store.id];
          const low = values.quantity <= values.alert_threshold;
          return (
            <TR key={store.id}>
              <TD className="font-medium text-slate-900">{store.name}</TD>
              <TD>
                <Input
                  type="number"
                  min={0}
                  disabled={!editable}
                  value={values.quantity}
                  className="w-28"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [store.id]: { ...d[store.id], quantity: Number(e.target.value) },
                    }))
                  }
                />
              </TD>
              <TD>
                <Input
                  type="number"
                  min={0}
                  disabled={!editable}
                  value={values.alert_threshold}
                  className="w-28"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [store.id]: { ...d[store.id], alert_threshold: Number(e.target.value) },
                    }))
                  }
                />
              </TD>
              <TD>
                <Badge tone={low ? "warning" : "success"}>{low ? "Stock bas" : "OK"}</Badge>
              </TD>
              <TD className="text-right">
                {editable && (
                  <Button size="sm" variant="secondary" onClick={() => handleSave(store.id)} disabled={isPending}>
                    <Save className="h-4 w-4" />
                    {savedId === store.id ? "Enregistré" : "Enregistrer"}
                  </Button>
                )}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
