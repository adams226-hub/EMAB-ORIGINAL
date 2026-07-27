"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { CountStatusBadge } from "./CountStatusBadge";
import { formatDate } from "@/lib/utils";
import type { StockCount } from "@/types/database.types";
import { updateCountItem, submitStockCount, validateStockCount } from "@/app/(dashboard)/stock/counts/actions";

export interface CountItemRow {
  product_id: string;
  product_name: string;
  sku: string;
  expected_quantity: number;
  counted_quantity: number | null;
}

export function CountDetail({
  count,
  storeName,
  items,
  canEdit,
  canSubmit,
  canValidate,
}: {
  count: StockCount;
  storeName: string;
  items: CountItemRow[];
  canEdit: boolean;
  canSubmit: boolean;
  canValidate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.product_id, i.counted_quantity?.toString() ?? ""]))
  );
  const [savedId, setSavedId] = useState<string | null>(null);

  function handleSave(productId: string) {
    const value = draft[productId];
    if (value === "") return;
    startTransition(async () => {
      const result = await updateCountItem(count.id, productId, Number(value));
      if (result.error) alert(result.error);
      setSavedId(productId);
      router.refresh();
      setTimeout(() => setSavedId(null), 1500);
    });
  }

  function handleSubmit() {
    if (!confirm("Soumettre cet inventaire pour validation ? Le comptage ne sera plus modifiable.")) return;
    startTransition(async () => {
      const result = await submitStockCount(count.id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  function handleValidate() {
    if (!confirm("Valider cet inventaire ? Les écarts seront appliqués au stock immédiatement.")) return;
    startTransition(async () => {
      const result = await validateStockCount(count.id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  const incompleteCount = items.filter((i) => i.counted_quantity === null).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{count.reference}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {storeName} · Créé le {formatDate(count.created_at)}
          </p>
        </div>
        <CountStatusBadge status={count.status} />
      </div>

      <Card>
        <CardHeader className="flex-wrap gap-2">
          <CardTitle>Comptage ({items.length} produits)</CardTitle>
          <div className="flex gap-2">
            {canSubmit && (
              <Button size="sm" onClick={handleSubmit} disabled={isPending || incompleteCount > 0}>
                <Send className="h-4 w-4" />
                Soumettre {incompleteCount > 0 ? `(${incompleteCount} restant(s))` : ""}
              </Button>
            )}
            {canValidate && (
              <Button size="sm" onClick={handleValidate} disabled={isPending}>
                <CheckCircle2 className="h-4 w-4" />
                Valider l'inventaire
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Produit</TH>
                <TH>Stock théorique</TH>
                <TH>Quantité comptée</TH>
                <TH>Écart</TH>
                {canEdit && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {items.map((item) => {
                const counted = draft[item.product_id] === "" ? null : Number(draft[item.product_id]);
                const diff = counted === null ? null : counted - item.expected_quantity;
                return (
                  <TR key={item.product_id}>
                    <TD>
                      <div className="font-medium text-slate-900">{item.product_name}</div>
                      <div className="text-xs text-slate-400">{item.sku}</div>
                    </TD>
                    <TD>{item.expected_quantity.toLocaleString("fr-FR")}</TD>
                    <TD>
                      {canEdit ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-28"
                          value={draft[item.product_id]}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [item.product_id]: e.target.value }))
                          }
                        />
                      ) : (
                        item.counted_quantity?.toLocaleString("fr-FR") ?? "—"
                      )}
                    </TD>
                    <TD>
                      {diff === null ? (
                        <span className="text-slate-400">—</span>
                      ) : diff === 0 ? (
                        <Badge tone="success">0</Badge>
                      ) : (
                        <Badge tone={diff > 0 ? "success" : "danger"}>
                          {diff > 0 ? `+${diff}` : diff}
                        </Badge>
                      )}
                    </TD>
                    {canEdit && (
                      <TD className="text-right">
                        <Button size="sm" variant="secondary" onClick={() => handleSave(item.product_id)} disabled={isPending}>
                          <Save className="h-4 w-4" />
                          {savedId === item.product_id ? "Enregistré" : "Enregistrer"}
                        </Button>
                      </TD>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
