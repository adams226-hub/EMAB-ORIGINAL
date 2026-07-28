"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { parseXlsxFile } from "@/lib/xlsx-browser";
import { importProducts, type ImportSummary } from "@/app/(dashboard)/products/import-actions";

export function ProductImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSummary(null);
    setError(undefined);

    parseXlsxFile(file)
      .then((parsed) => {
        if (parsed.length === 0) {
          setError("Fichier vide ou illisible.");
          return;
        }
        setRows(parsed);
      })
      .catch(() => setError("Fichier Excel invalide ou illisible."));
  }

  function handleImport() {
    startTransition(async () => {
      const result = await importProducts(rows);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSummary(result.summary ?? null);
      setRows([]);
      router.refresh();
    });
  }

  function handleClose() {
    setRows([]);
    setSummary(null);
    setError(undefined);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importer des produits (Excel)">
      <div className="space-y-4">
        <FormError message={error} />

        {summary ? (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="font-medium">{summary.created} produit(s) importé(s).</p>
            {summary.skipped.length > 0 && (
              <div>
                <p className="text-amber-700">{summary.skipped.length} ligne(s) ignorée(s) :</p>
                <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
                  {summary.skipped.slice(0, 10).map((s, i) => (
                    <li key={i}>
                      {s.sku} — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Colonnes attendues : <code className="text-xs">name, sku, category, unit, purchase_price,
              sale_price, description</code>. Les SKU déjà existants sont ignorés.
            </p>
            <a href="/api/products/import-template">
              <Button type="button" variant="secondary" size="sm">
                <FileText className="h-4 w-4" />
                Télécharger le modèle
              </Button>
            </a>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFile}
                className="text-sm"
              />
              {fileName && <p className="mt-1 text-xs text-slate-400">{fileName} — {rows.length} ligne(s) détectée(s)</p>}
            </div>

            {rows.length > 0 && (
              <div className="max-h-56 overflow-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Nom</TH>
                      <TH>SKU</TH>
                      <TH>Catégorie</TH>
                      <TH>Prix vente</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.slice(0, 8).map((r, i) => (
                      <TR key={i}>
                        <TD>{r.name}</TD>
                        <TD>{r.sku}</TD>
                        <TD>{r.category || "—"}</TD>
                        <TD>{r.sale_price}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                {rows.length > 8 && <p className="mt-1 text-xs text-slate-400">+ {rows.length - 8} autre(s) ligne(s)</p>}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {summary ? "Fermer" : "Annuler"}
          </Button>
          {!summary && (
            <Button type="button" onClick={handleImport} disabled={isPending || rows.length === 0}>
              <Upload className="h-4 w-4" />
              {isPending ? "Import en cours..." : `Importer ${rows.length} produit(s)`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
