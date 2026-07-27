"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Ruler } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { FormError } from "@/components/ui/FormError";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Unit } from "@/types/database.types";
import { createUnit, updateUnit, deleteUnit, type UnitInput } from "@/app/(dashboard)/units/actions";

export function UnitsManager({ units, canDelete }: { units: Unit[]; canDelete: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [values, setValues] = useState<UnitInput>({ name: "", abbreviation: "" });

  function openCreate() {
    setEditing(null);
    setValues({ name: "", abbreviation: "" });
    setError(undefined);
    setModalOpen(true);
  }

  function openEdit(unit: Unit) {
    setEditing(unit);
    setValues({ name: unit.name, abbreviation: unit.abbreviation });
    setError(undefined);
    setModalOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = editing ? await updateUnit(editing.id, values) : await createUnit(values);
      if (result.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleDelete(unit: Unit) {
    if (!confirm(`Supprimer l'unité "${unit.name}" ?`)) return;
    startTransition(async () => {
      const result = await deleteUnit(unit.id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Unités de mesure</h1>
          <p className="mt-1 text-sm text-slate-500">{units.length} unité(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle unité
        </Button>
      </div>

      {units.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="Aucune unité"
          description="Créez des unités (pièce, kg, litre...) pour standardiser votre catalogue."
          action={
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Créer une unité
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nom</TH>
              <TH>Abréviation</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {units.map((unit) => (
              <TR key={unit.id}>
                <TD className="font-medium text-slate-900">{unit.name}</TD>
                <TD>{unit.abbreviation}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(unit)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(unit)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'unité" : "Nouvelle unité"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormError message={error} />
          <div>
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              required
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="Kilogramme"
            />
          </div>
          <div>
            <Label htmlFor="abbreviation">Abréviation</Label>
            <Input
              id="abbreviation"
              required
              value={values.abbreviation}
              onChange={(e) => setValues((v) => ({ ...v, abbreviation: e.target.value }))}
              placeholder="kg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement..." : editing ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
