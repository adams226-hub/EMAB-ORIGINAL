"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, Search, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormError } from "@/components/ui/FormError";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { groupByCategory } from "@/lib/productCategoryOrder";
import type { Customer, PaymentMethod } from "@/types/database.types";
import { createSale } from "@/app/(dashboard)/pos/actions";

export interface POSProduct {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
  wholesale_price: number | null;
  unit: string;
  category_name: string | null;
  stock_quantity: number;
}

type SaleType = "retail" | "wholesale";

interface CartLine {
  product_id: string;
  name: string;
  sku: string;
  unit_price: number;
  sale_type: SaleType;
  quantity: number;
  discount_percent: number;
  available_stock: number;
}

export function POSTerminal({
  storeId,
  products,
  customers,
  paymentMethods,
}: {
  storeId: string;
  products: POSProduct[];
  customers: Customer[];
  paymentMethods: PaymentMethod[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("retail");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [amountPaidTouched, setAmountPaidTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const productGroups = useMemo(() => groupByCategory(filteredProducts), [filteredProducts]);

  const subtotal = cart.reduce(
    (sum, line) => sum + line.quantity * line.unit_price * (1 - line.discount_percent / 100),
    0
  );
  const total = Math.round(subtotal * (1 - globalDiscount / 100) * 100) / 100;
  const effectiveAmountPaid = amountPaidTouched ? Number(amountPaid || 0) : total;

  function priceFor(product: POSProduct, type: SaleType) {
    return type === "wholesale" && product.wholesale_price != null ? product.wholesale_price : product.sale_price;
  }

  function addProduct(product: POSProduct) {
    const unit_price = priceFor(product, saleType);
    setCart((lines) => {
      const existing = lines.find((l) => l.product_id === product.id && l.sale_type === saleType);
      if (existing) {
        return lines.map((l) =>
          l.product_id === product.id && l.sale_type === saleType ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...lines,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit_price,
          sale_type: saleType,
          quantity: 1,
          discount_percent: 0,
          available_stock: product.stock_quantity,
        },
      ];
    });
  }

  function updateQuantity(productId: string, saleTypeKey: SaleType, quantity: number) {
    if (quantity <= 0) {
      setCart((lines) => lines.filter((l) => !(l.product_id === productId && l.sale_type === saleTypeKey)));
      return;
    }
    setCart((lines) =>
      lines.map((l) => (l.product_id === productId && l.sale_type === saleTypeKey ? { ...l, quantity } : l))
    );
  }

  function updateDiscount(productId: string, saleTypeKey: SaleType, discount_percent: number) {
    setCart((lines) =>
      lines.map((l) => (l.product_id === productId && l.sale_type === saleTypeKey ? { ...l, discount_percent } : l))
    );
  }

  function removeLine(productId: string, saleTypeKey: SaleType) {
    setCart((lines) => lines.filter((l) => !(l.product_id === productId && l.sale_type === saleTypeKey)));
  }

  function resetSale() {
    setCart([]);
    setCustomerId("");
    setWalkinName("");
    setWalkinPhone("");
    setGlobalDiscount(0);
    setAmountPaid("");
    setAmountPaidTouched(false);
    setNotes("");
  }

  function handleSubmit() {
    setError(undefined);

    if (cart.length === 0) {
      setError("Le panier est vide");
      return;
    }
    if (effectiveAmountPaid < total && !customerId) {
      setError("Sélectionnez un client pour enregistrer une vente à crédit (créance)");
      return;
    }
    if (!customerId && (!walkinName.trim() || !walkinPhone.trim())) {
      setError("Le nom et le téléphone du client sont obligatoires.");
      return;
    }

    startTransition(async () => {
      const result = await createSale({
        store_id: storeId,
        customer_id: customerId || null,
        discount_percent: globalDiscount,
        payment_method_id: effectiveAmountPaid > 0 ? paymentMethodId : null,
        amount_paid: effectiveAmountPaid,
        notes: notes || undefined,
        walkin_name: customerId ? undefined : walkinName || undefined,
        walkin_phone: customerId ? undefined : walkinPhone || undefined,
        items: cart.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_percent: l.discount_percent,
          sale_type: l.sale_type,
        })),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      resetSale();
      router.push(`/sales/${result.saleId}/receipt`);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un produit par nom ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm font-medium">
          <button
            onClick={() => setSaleType("retail")}
            className={`flex-1 rounded-md py-2 transition-colors ${
              saleType === "retail" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            Vente au détail
          </button>
          <button
            onClick={() => setSaleType("wholesale")}
            className={`flex-1 rounded-md py-2 transition-colors ${
              saleType === "wholesale" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            Vente en gros
          </button>
        </div>

        <div className="space-y-5">
          {productGroups.map(({ category, items: groupProducts }) => (
            <div key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {category} ({groupProducts.length})
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {groupProducts.map((product) => {
                  const hasWholesale = product.wholesale_price != null;
                  const price = priceFor(product, saleType);
                  return (
                    <button
                      key={product.id}
                      onClick={() => addProduct(product)}
                      className="flex flex-col items-start rounded-xl border border-slate-200 bg-white p-3 text-left shadow-card transition-colors hover:border-brand-300 hover:bg-brand-50"
                    >
                      <span className="line-clamp-2 text-sm font-medium text-slate-900">{product.name}</span>
                      <span className="mt-1 text-xs text-slate-400">{product.sku}</span>
                      <div className="mt-2 flex w-full items-center justify-between">
                        <span className="text-sm font-semibold text-brand-600">{formatCurrency(price)}</span>
                        <Badge tone={product.stock_quantity > 0 ? "default" : "danger"}>
                          {product.stock_quantity} en stock
                        </Badge>
                      </div>
                      {saleType === "wholesale" && !hasWholesale && (
                        <span className="mt-1 text-[11px] text-amber-600">Pas de prix de gros — prix détail appliqué</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <EmptyState icon={ShoppingBag} title="Aucun produit" description="Aucun résultat pour cette recherche." />
          )}
        </div>
      </div>

      <Card className="lg:sticky lg:top-6 h-fit">
        <CardHeader>
          <CardTitle>Panier ({cart.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError message={error} />

          <div className="max-h-64 space-y-3 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-sm text-slate-400">Ajoutez des produits pour commencer une vente.</p>
            ) : (
              cart.map((line) => (
                <div key={`${line.product_id}-${line.sale_type}`} className="rounded-lg border border-slate-100 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{line.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(line.unit_price)} / unité
                        {line.sale_type === "wholesale" && (
                          <Badge tone="default" className="ml-2">
                            Gros
                          </Badge>
                        )}
                      </p>
                    </div>
                    <button onClick={() => removeLine(line.product_id, line.sale_type)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateQuantity(line.product_id, line.sale_type, line.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateQuantity(line.product_id, line.sale_type, Number(e.target.value))}
                        className="h-8 w-14 text-center"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateQuantity(line.product_id, line.sale_type, line.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCurrency(line.quantity * line.unit_price * (1 - line.discount_percent / 100))}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    Remise ligne
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={line.discount_percent}
                      onChange={(e) => updateDiscount(line.product_id, line.sale_type, Number(e.target.value))}
                      className="h-6 w-14 text-xs"
                    />
                    %
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Sous-total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Remise globale (%)</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                className="h-8 w-20 text-right"
              />
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Client de passage</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            {!customerId && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Nom du client"
                  required
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                />
                <Input
                  placeholder="Téléphone"
                  required
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className="flex-1">
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={0}
                max={total}
                step="0.01"
                placeholder="Montant payé"
                value={amountPaidTouched ? amountPaid : total}
                onChange={(e) => {
                  setAmountPaidTouched(true);
                  setAmountPaid(e.target.value);
                }}
                className="w-32"
              />
            </div>
            {effectiveAmountPaid < total && (
              <p className="text-xs text-amber-600">
                Solde restant dû : {formatCurrency(total - effectiveAmountPaid)} (créance client)
              </p>
            )}
          </div>

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isPending || cart.length === 0}>
            {isPending ? "Traitement..." : `Valider la vente — ${formatCurrency(total)}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
