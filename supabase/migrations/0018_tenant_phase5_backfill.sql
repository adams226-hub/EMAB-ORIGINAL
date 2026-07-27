-- =====================================================================
-- EMAB ERP — Phase 5 — Multi-tenant SaaS : backfill des données existantes
-- Toutes les données créées avant cette migration (Phases 1-4) sont
-- rattachées à un tenant "par défaut" représentant l'entreprise déjà
-- en place, puis tenant_id devient obligatoire partout.
-- =====================================================================

insert into public.tenants (id, name, slug, plan, status, max_stores, max_users, trial_ends_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'EMAB — Compte principal',
  'emab-principal',
  'enterprise',
  'active',
  9999,
  9999,
  now() + interval '100 years'
)
on conflict (id) do nothing;

do $$
declare
  t text;
  default_tenant uuid := '00000000-0000-0000-0000-000000000001';
begin
  foreach t in array array[
    'stores', 'profiles', 'categories', 'products', 'product_stock',
    'units', 'suppliers', 'stock_movements', 'purchase_orders', 'purchase_order_items',
    'stock_transfers', 'stock_transfer_items', 'stock_counts', 'stock_count_items',
    'payment_methods', 'customers', 'expense_categories', 'expenses',
    'sales', 'sale_items', 'payments', 'cash_sessions', 'cash_adjustments'
  ]
  loop
    execute format('update public.%I set tenant_id = %L where tenant_id is null', t, default_tenant);
    execute format('alter table public.%I alter column tenant_id set not null', t);
  end loop;
end $$;
