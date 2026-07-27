import Link from "next/link";
import { AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AnalyticalAlert } from "@/lib/analytics/alerts";

export function AlertsPanel({ alerts }: { alerts: AnalyticalAlert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertes analytiques</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Aucune alerte — les indicateurs sont dans la normale.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Link
                  href={alert.href}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
                >
                  {alert.severity === "critical" ? (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                    <p className="text-xs text-slate-500">{alert.description}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
