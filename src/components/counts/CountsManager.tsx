"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { FormError } from "@/components/ui/FormError";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import type { Store, StockCount } from "@/types/database.types";
import { CountStatusBadge } from "./CountStatusBadge";
import { createStockCount } from "@/app/(dashboard)/stock/counts/actions";

export interface CountRow extends StockCount {
  store_name: string;
}

export function CountsManager({
  counts,
  stores,
  fixedStoreId,
}: {
  counts: CountRow[];
  stores: Store[];
  fixedStoreId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [storeId, setStoreId] = useState(fixedStoreId ?? "");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createStockCount({ store_id: storeId, notes: notes || undefined });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventaires</h1>
          <p className="mt-1 text-sm text-slate-500">{counts.length} inventaire(s)</p>
        </div>
        <Button
          onClick={() => {
            setError(undefined);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nouvel inventaire
        </Button>
      </div>

      {counts.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun inventaire"
          description="Lancez un comptage physique pour vérifier et corriger le stock réel."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>Magasin</TH>
              <TH>Statut</TH>
              <TH>Créé le</TH>
            </TR>
          </THead>
          <TBody>
            {counts.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link href={`/stock/counts/${c.id}`} className="font-medium text-brand-600 hover:underline">
                    {c.reference}
                  </Link>
                </TD>
                <TD>{c.store_name}</TD>
                <TD>
                  <CountStatusBadge status={c.status} />
                </TD>
                <TD className="text-sm text-slate-500">{formatDate(c.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvel inventaire">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormError message={error} />
          <p className="text-sm text-slate-500">
            L'inventaire inclura tous les produits actifs du magasin, avec le stock théorique actuel comme
            référence. Vous saisirez ensuite la quantité réellement comptée pour chacun.
          </p>

          {!fixedStoreId && (
            <div>
              <Label htmlFor="store_id">Magasin</Label>
              <Select id="store_id" required value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="">Sélectionner un magasin</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending || (!fixedStoreId && !storeId)}>
              {isPending ? "Création..." : "Lancer l'inventaire"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
