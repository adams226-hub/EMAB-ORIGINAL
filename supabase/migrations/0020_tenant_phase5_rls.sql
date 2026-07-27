-- =====================================================================
-- EMAB ERP — Phase 5 — Multi-tenant SaaS : isolation RLS
--
-- Plutôt que de réécrire les ~80 policies déjà en place (Phases 1-4),
-- on ajoute UNE policy RESTRICTIVE par table : en PostgreSQL, une policy
-- RESTRICTIVE est combinée en ET logique avec toutes les policies
-- PERMISSIVE existantes (qui, elles, restent combinées en OU entre
-- elles). Résultat : quel que soit ce qu'une policy PERMISSIVE de Phase
-- 1-3 autorise (rôle, magasin), la ligne doit EN PLUS appartenir au
-- tenant de l'utilisateur — sans modifier une seule policy existante.
-- =====================================================================

alter table public.tenants enable row level security;

create policy "tenants_select_own" on public.tenants
  for select using (id = public.my_tenant_id());

-- Pas de policy insert/update/delete pour les utilisateurs standards :
-- la création de tenant passe par handle_new_user() (0021, SECURITY
-- DEFINER, bypass RLS). Les changements de plan/statut (facturation)
-- sont, tant qu'aucune passerelle de paiement n'est branchée (Phase 6),
-- effectués directement par l'opérateur SaaS via la base de données.

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
    execute format(
      'create policy tenant_isolation on public.%I as restrictive for all using (tenant_id = public.my_tenant_id()) with check (tenant_id = public.my_tenant_id());',
      t
    );
  end loop;
end $$;
