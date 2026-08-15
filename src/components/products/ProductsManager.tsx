"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Package, Upload } from "lucide-react";
import { ProductImportModal } from "./ProductImportModal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import type { Category, Product, Store } from "@/types/database.types";
import { ProductForm } from "./ProductForm";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductActive,
  type ProductInput,
} from "@/app/(dashboard)/products/actions";

export interface ProductRow extends Product {
  category_name: string | null;
  total_stock: number;
}

export function ProductsManager({
  products,
  categories,
  stores,
  canDelete,
  hasOwnStore,
}: {
  products: ProductRow[];
  categories: Category[];
  stores: Store[];
  canDelete: boolean;
  hasOwnStore: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [importOpen, setImportOpen] = useState(false);

  function openCreate() {
    setEditing(null);
    setError(undefined);
    setModalOpen(true);
  }

  function openEdit(product: ProductRow) {
    setEditing(product);
    setError(undefined);
    setModalOpen(true);
  }

  function handleSubmit(input: ProductInput) {
    startTransition(async () => {
      const result = editing ? await updateProduct(editing.id, input) : await createProduct(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleDelete(product: ProductRow) {
    if (!confirm(`Supprimer le produit "${product.name}" ?`)) return;
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  function handleToggle(product: ProductRow) {
    startTransition(async () => {
      await toggleProductActive(product.id, !product.is_active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Produits</h1>
          <p className="mt-1 text-sm text-slate-500">{products.length} produit(s) au catalogue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Importer Excel
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aucun produit"
          description="Ajoutez votre premier produit au catalogue partagé de vos magasins."
          action={
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Créer un produit
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Produit</TH>
              <TH>Catégorie</TH>
              <TH>Prix de vente</TH>
              <TH>Stock total</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {products.map((product) => (
              <TR key={product.id}>
                <TD>
                  <Link href={`/products/${product.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                    {product.name}
                  </Link>
                  <div className="text-xs text-slate-400">{product.sku}</div>
                </TD>
                <TD>{product.category_name ?? "—"}</TD>
                <TD>
                  <div>{formatCurrency(product.sale_price)}</div>
                  {product.wholesale_price != null && (
                    <div className="text-xs text-slate-400">Gros : {formatCurrency(product.wholesale_price)}</div>
                  )}
                </TD>
                <TD>{product.total_stock.toLocaleString("fr-FR")}</TD>
                <TD>
                  <button onClick={() => handleToggle(product)}>
                    <Badge tone={product.is_active ? "success" : "default"}>
                      {product.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </button>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(product)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(product)}>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier le produit" : "Nouveau produit"}
      >
        <ProductForm
          initial={editing}
          categories={categories}
          stores={stores}
          showInitialStock={!editing && hasOwnStore}
          showStoreStocks={!editing && !hasOwnStore && stores.length > 0}
          pending={isPending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <ProductImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
