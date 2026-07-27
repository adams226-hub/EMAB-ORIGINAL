import { Download, FileBarChart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { getFinancialSummary } from "@/lib/finance/summary";
import { PeriodFilterBar } from "@/components/finance/PeriodFilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function defaultPeriod() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const profile = await requireRole(["super_admin", "manager"]);
  const supabase = createClient();

  const defaults = defaultPeriod();
  const from = searchParams.from ?? defaults.from;
  const to = searchParams.to ?? defaults.to;
  const storeId = profile.role === "super_admin" ? null : profile.store_id;

  const summary = await getFinancialSummary(supabase, { storeId, from, to });

  const exportParams = new URLSearchParams({ from, to });
  if (storeId) exportParams.set("store_id", storeId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Rapports financiers</h1>
        <p className="mt-1 text-sm text-slate-500">{profile.store_name ?? "Tous les magasins"}</p>
      </div>

      <PeriodFilterBar from={from} to={to} />

      <Card>
        <CardHeader>
          <CardTitle>Compte de résultat simplifié</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Chiffre d&apos;affaires</span>
            <span className="font-medium text-slate-900">{formatCurrency(summary.revenue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Coût des marchandises vendues</span>
            <span>−{formatCurrency(summary.cogs)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Marge brute</span>
            <span>{formatCurrency(summary.grossMargin)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Dépenses</span>
            <span>−{formatCurrency(summary.expensesTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
            <span>Bénéfice net</span>
            <span>{formatCurrency(summary.netProfit)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rapport des ventes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Détail de toutes les ventes de la période, avec statut de paiement — fichier Excel (.xlsx).
            </p>
            <a
              href={`/api/reports/sales?${exportParams.toString()}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Download className="h-4 w-4" />
              Télécharger Excel
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rapport des dépenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Détail de toutes les dépenses de la période, par catégorie et mode de paiement.
            </p>
            <a
              href={`/api/reports/expenses?${exportParams.toString()}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Download className="h-4 w-4" />
              Télécharger Excel
            </a>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <FileBarChart className="h-3.5 w-3.5" />
        Pour un export PDF de ce rapport, utilisez l&apos;impression du navigateur (Ctrl/Cmd+P) depuis cette page.
      </p>
    </div>
  );
}
