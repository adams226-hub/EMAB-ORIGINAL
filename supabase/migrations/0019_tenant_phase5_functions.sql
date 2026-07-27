-- =====================================================================
-- EMAB ERP — Phase 5 — Multi-tenant SaaS : fonctions et triggers
-- =====================================================================

-- ---------------------------------------------------------------------
-- my_tenant_id() : même pattern que my_role()/my_store_id() (0002),
-- SECURITY DEFINER pour lire profiles sans dépendre de la RLS (évite
-- toute récursion).
-- ---------------------------------------------------------------------
create or replace function public.my_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- store_in_my_tenant(p_store_id) : garde-fou utilisé par les fonctions
-- SECURITY DEFINER (0011, 0005) qui reçoivent un store_id en paramètre
-- — ces fonctions bypassent la RLS et doivent donc vérifier elles-mêmes
-- que le magasin ciblé appartient bien au tenant de l'appelant.
-- ---------------------------------------------------------------------
create or replace function public.store_in_my_tenant(p_store_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.stores where id = p_store_id and tenant_id = public.my_tenant_id()
  );
$$;

-- ---------------------------------------------------------------------
-- set_tenant_id() : auto-remplissage de tenant_id à l'insertion, à
-- partir du tenant de l'utilisateur connecté. Élimine le besoin de
-- modifier les dizaines de Server Actions et fonctions RPC déjà écrites
-- dans les Phases 1-4 : elles continuent d'insérer sans jamais mentionner
-- tenant_id, il est renseigné automatiquement et de façon fiable ici.
-- Non appliqué à `profiles`, dont le tenant_id est déterminé
-- explicitement par la logique d'inscription (0021).
-- ---------------------------------------------------------------------
create or replace function public.set_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is null then
    new.tenant_id := public.my_tenant_id();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'stores', 'categories', 'products', 'product_stock',
    'units', 'suppliers', 'stock_movements', 'purchase_orders', 'purchase_order_items',
    'stock_transfers', 'stock_transfer_items', 'stock_counts', 'stock_count_items',
    'payment_methods', 'customers', 'expense_categories', 'expenses',
    'sales', 'sale_items', 'payments', 'cash_sessions', 'cash_adjustments'
  ]
  loop
    execute format(
      'create trigger trg_set_tenant_id before insert on public.%I for each row execute function public.set_tenant_id();',
      t
    );
  end loop;
end $$;
