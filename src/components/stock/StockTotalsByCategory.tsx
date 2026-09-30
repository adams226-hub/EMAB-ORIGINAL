import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatCurrency } from "@/lib/utils";

export interface StockTotalByCategoryRow {
  category_name: string;
  quantity: number;
  value: number;
}

export function StockTotalsByCategory({ rows }: { rows: StockTotalByCategoryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock par catégorie</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Aucun stock pour le moment.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Catégorie</TH>
                <TH>Unités en stock</TH>
                <TH>Valeur</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.category_name}>
                  <TD className="font-medium text-slate-900">{r.category_name}</TD>
                  <TD>{r.quantity.toLocaleString("fr-FR")}</TD>
                  <TD>{formatCurrency(r.value)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
