"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatCurrency } from "@/lib/utils";

export interface TodayProductSalesRow {
  product_name: string;
  sku: string;
  quantity: number;
  total: number;
}

export function TodaySalesByProduct({ rows }: { rows: TodayProductSalesRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.product_name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventes du jour par produit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un produit par nom ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Aucune vente aujourd&apos;hui pour le moment.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Produit</TH>
                  <TH>Quantité vendue</TH>
                  <TH>Total</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((r) => (
                  <TR key={r.sku || r.product_name}>
                    <TD>
                      <div className="font-medium text-slate-900">{r.product_name}</div>
                      <div className="text-xs text-slate-400">{r.sku}</div>
                    </TD>
                    <TD className="font-medium">{r.quantity.toLocaleString("fr-FR")}</TD>
                    <TD>{formatCurrency(r.total)}</TD>
                  </TR>
                ))}
                {filtered.length === 0 && (
                  <TR>
                    <TD colSpan={3} className="text-center text-sm text-slate-400">
                      Aucun produit ne correspond à cette recherche.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
