-- =====================================================================
-- EMAB ERP — Phase 5 — Multi-tenant SaaS : schéma
-- Isolation réelle entre entreprises clientes sur une base partagée.
-- tenant_id est dénormalisé sur CHAQUE table métier plutôt que dérivé
-- par jointure dans les policies RLS : à l'échelle, une comparaison de
-- colonne directe est très supérieure en performance à une sous-requête
-- de jointure évaluée à chaque ligne (recommandation Supabase officielle
-- pour le multi-tenant RLS).
-- =====================================================================

create type public.tenant_plan as enum ('trial', 'starter', 'pro', 'enterprise');
create type public.tenant_status as enum ('trial', 'active', 'suspended', 'cancelled');

create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  plan            public.tenant_plan not null default 'trial',
  status          public.tenant_status not null default 'trial',
  max_stores      integer not null default 3,
  max_users       integer not null default 10,
  trial_ends_at   timestamptz not null default (now() + interval '14 days'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Ajout de tenant_id sur toutes les tables métier des Phases 1 à 4.
-- Nullable pour l'instant : le backfill (0018) l'assigne aux données
-- existantes avant de verrouiller la contrainte NOT NULL.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'stores', 'profiles', 'categories', 'products', 'product_stock',
    'units', 'suppliers', 'stock_movements', 'purchase_orders', 'purchase_order_items',
    'stock_transfers', 'stock_transfer_items', 'stock_counts', 'stock_count_items',
    'payment_methods', 'customers', 'expense_categories', 'expenses',
    'sales', 'sale_items', 'payments', 'cash_sessions', 'cash_adjustments'
  ]
  loop
    execute format('alter table public.%I add column if not exists tenant_id uuid references public.tenants(id)', t);
    execute format('create index if not exists idx_%s_tenant on public.%I(tenant_id)', t, t);
  end loop;
end $$;
