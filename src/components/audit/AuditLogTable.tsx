"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";
import type { AuditAction, AuditLogEntry } from "@/types/database.types";

const TABLE_LABELS: Record<string, string> = {
  tenants: "Entreprise",
  stores: "Magasin",
  profiles: "Utilisateur",
  categories: "Catégorie",
  products: "Produit",
  units: "Unité",
  stock_counts: "Inventaire",
  payment_methods: "Mode de paiement",
  customers: "Client",
  expense_categories: "Catégorie de dépense",
  expenses: "Dépense",
  sales: "Vente",
};

const ACTION_LABELS: Record<AuditAction, string> = { insert: "Création", update: "Modification", delete: "Suppression" };
const ACTION_TONES: Record<AuditAction, "success" | "warning" | "danger"> = {
  insert: "success",
  update: "warning",
  delete: "danger",
};

// Champs purement techniques, sans intérêt pour la lecture métier de l'audit.
const HIDDEN_FIELDS = new Set(["id", "tenant_id"]);

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  full_name: "Nom complet",
  reference: "Référence",
  store_id: "Magasin",
  customer_id: "Client",
  category_id: "Catégorie",
  payment_method_id: "Mode de paiement",
  sold_by: "Vendu par",
  created_by: "Créé par",
  validated_by: "Validé par",
  sale_date: "Date de vente",
  expense_date: "Date de dépense",
  created_at: "Créé le",
  updated_at: "Modifié le",
  validated_at: "Validé le",
  trial_ends_at: "Fin de l'essai",
  subtotal: "Sous-total",
  discount_percent: "Remise (%)",
  total_amount: "Montant total",
  amount_paid: "Montant payé",
  amount_due: "Solde dû",
  amount: "Montant",
  status: "Statut",
  notes: "Notes",
  reason: "Motif",
  type: "Type",
  role: "Rôle",
  phone: "Téléphone",
  email: "Email",
  address: "Adresse",
  credit_limit: "Limite de crédit",
  is_active: "Actif",
  is_cash: "Paiement en espèces",
  sku: "SKU",
  barcode: "Code-barre",
  unit: "Unité",
  purchase_price: "Prix d'achat",
  sale_price: "Prix de vente",
  description: "Description",
  slug: "Slug",
  abbreviation: "Abréviation",
  code: "Code",
  plan: "Formule",
  max_stores: "Nombre max de magasins",
  max_users: "Nombre max d'utilisateurs",
  counted_quantity: "Quantité comptée",
  expected_quantity: "Quantité attendue",
};

const VALUE_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  validated: "Validé",
  completed: "Terminé",
  cancelled: "Annulé",
  open: "Ouvert",
  closed: "Fermé",
  pending: "En attente",
  active: "Actif",
  suspended: "Suspendu",
  in: "Entrée",
  out: "Sortie",
};

function humanizeKey(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && VALUE_LABELS[value]) return VALUE_LABELS[value];
  return String(value);
}

type DiffRow = { key: string; before?: string; after?: string };

function buildDiff(entry: AuditLogEntry): DiffRow[] {
  const before = (entry.old_data ?? {}) as Record<string, unknown>;
  const after = (entry.new_data ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  const rows: DiffRow[] = [];
  for (const key of keys) {
    if (HIDDEN_FIELDS.has(key)) continue;

    if (entry.action === "update") {
      if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
      rows.push({ key, before: formatAuditValue(before[key]), after: formatAuditValue(after[key]) });
    } else if (entry.action === "delete") {
      rows.push({ key, before: formatAuditValue(before[key]) });
    } else {
      rows.push({ key, after: formatAuditValue(after[key]) });
    }
  }

  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

export function AuditLogTable({ entries }: { entries: AuditLogEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Table>
      <THead>
        <TR>
          <TH />
          <TH>Date</TH>
          <TH>Entité</TH>
          <TH>Action</TH>
          <TH>Par</TH>
        </TR>
      </THead>
      <TBody>
        {entries.map((entry) => (
          <Fragment key={entry.id}>
            <TR className="cursor-pointer" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
              <TD className="w-8">
                {expanded === entry.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </TD>
              <TD className="whitespace-nowrap text-sm text-slate-500">{formatDate(entry.created_at)}</TD>
              <TD className="font-medium text-slate-900">{TABLE_LABELS[entry.table_name] ?? entry.table_name}</TD>
              <TD>
                <Badge tone={ACTION_TONES[entry.action]}>{ACTION_LABELS[entry.action]}</Badge>
              </TD>
              <TD>{entry.changed_by_name ?? "Système"}</TD>
            </TR>
            {expanded === entry.id && (
              <TR>
                <TD colSpan={5} className="bg-slate-50 p-3">
                  {(() => {
                    const diff = buildDiff(entry);
                    if (diff.length === 0) {
                      return <p className="text-sm text-slate-400">Aucun changement de valeur détecté.</p>;
                    }
                    return (
                      <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-sm">
                          <tbody>
                            {diff.map((row) => (
                              <tr key={row.key} className="border-b border-slate-100 last:border-0">
                                <td className="whitespace-nowrap px-3 py-1.5 font-medium text-slate-700">
                                  {humanizeKey(row.key)}
                                </td>
                                {entry.action === "update" ? (
                                  <td className="px-3 py-1.5 text-slate-600">
                                    <span className="text-slate-400 line-through">{row.before}</span>
                                    {" → "}
                                    <span className="text-slate-900">{row.after}</span>
                                  </td>
                                ) : (
                                  <td className="px-3 py-1.5 text-slate-600">{row.before ?? row.after}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </TD>
              </TR>
            )}
          </Fragment>
        ))}
        {entries.length === 0 && (
          <TR>
            <TD colSpan={5} className="text-center text-sm text-slate-400">
              Aucune entrée pour ces critères
            </TD>
          </TR>
        )}
      </TBody>
    </Table>
  );
}
