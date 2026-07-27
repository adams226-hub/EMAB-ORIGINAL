-- =====================================================================
-- EMAB ERP — Phase 3 — Row Level Security
-- Principe : toute écriture qui touche un solde financier (amount_paid,
-- stock via une vente, ouverture/fermeture de caisse) passe par une
-- fonction SECURITY DEFINER (0011) qui contourne délibérément la RLS
-- après avoir vérifié elle-même le rôle et le magasin de l'appelant.
-- Les policies ci-dessous ne couvrent donc que la LECTURE et les
-- écritures simples et sans risque (dépenses, ajustements de caisse,
-- référentiels).
-- =====================================================================

alter table public.payment_methods enable row level security;
alter table public.customers enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_adjustments enable row level security;

-- =====================================================================
-- PAYMENT_METHODS — référentiel global
-- =====================================================================
create policy "payment_methods_select_authenticated" on public.payment_methods
  for select using (auth.role() = 'authenticated');

create policy "payment_methods_write_admin_manager" on public.payment_methods
  for insert with check (public.my_role() in ('super_admin', 'manager'));

create policy "payment_methods_update_admin_manager" on public.payment_methods
  for update using (public.my_role() in ('super_admin', 'manager'));

create policy "payment_methods_delete_super_admin" on public.payment_methods
  for delete using (public.is_super_admin());

-- =====================================================================
-- CUSTOMERS — visible et gérable par le personnel de vente
-- =====================================================================
create policy "customers_select" on public.customers
  for select using (public.my_role() in ('super_admin', 'manager', 'cashier'));

create policy "customers_insert" on public.customers
  for insert with check (public.my_role() in ('super_admin', 'manager', 'cashier'));

create policy "customers_update" on public.customers
  for update using (public.my_role() in ('super_admin', 'manager', 'cashier'));

create policy "customers_delete_super_admin" on public.customers
  for delete using (public.is_super_admin());

-- =====================================================================
-- EXPENSE_CATEGORIES — référentiel géré par l'administration
-- =====================================================================
create policy "expense_categories_select_authenticated" on public.expense_categories
  for select using (auth.role() = 'authenticated');

create policy "expense_categories_write_admin_manager" on public.expense_categories
  for insert with check (public.my_role() in ('super_admin', 'manager'));

create policy "expense_categories_update_admin_manager" on public.expense_categories
  for update using (public.my_role() in ('super_admin', 'manager'));

create policy "expense_categories_delete_super_admin" on public.expense_categories
  for delete using (public.is_super_admin());

-- =====================================================================
-- EXPENSES — isolées par magasin, immuables (pas de policy update)
-- =====================================================================
create policy "expenses_select" on public.expenses
  for select using (
    public.my_role() in ('super_admin', 'manager')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

create policy "expenses_insert" on public.expenses
  for insert with check (
    public.my_role() in ('super_admin', 'manager')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

create policy "expenses_delete_super_admin" on public.expenses
  for delete using (public.is_super_admin());

-- =====================================================================
-- SALES / SALE_ITEMS — lecture scoping magasin, écriture via fn_create_sale
-- et fn_cancel_sale exclusivement (aucune policy insert/update/delete)
-- =====================================================================
create policy "sales_select" on public.sales
  for select using (
    public.my_role() in ('super_admin', 'manager', 'cashier')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

create policy "sale_items_select" on public.sale_items
  for select using (
    exists (
      select 1 from public.sales s
      where s.id = sale_id
        and public.my_role() in ('super_admin', 'manager', 'cashier')
        and (public.is_super_admin() or s.store_id = public.my_store_id())
    )
  );

-- =====================================================================
-- PAYMENTS — grand livre, lecture scoping magasin + rôle, écriture via
-- fn_record_payment / fn_create_sale exclusivement
-- =====================================================================
create policy "payments_select" on public.payments
  for select using (
    (public.is_super_admin() or store_id = public.my_store_id())
    and (
      (type = 'sale_payment' and public.my_role() in ('super_admin', 'manager', 'cashier'))
      or (type = 'purchase_payment' and public.my_role() in ('super_admin', 'manager'))
    )
  );

-- =====================================================================
-- CASH_SESSIONS — lecture scoping magasin, écriture via
-- fn_open_cash_session / fn_close_cash_session exclusivement
-- =====================================================================
create policy "cash_sessions_select" on public.cash_sessions
  for select using (
    public.my_role() in ('super_admin', 'manager', 'cashier')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

-- =====================================================================
-- CASH_ADJUSTMENTS — écriture directe autorisée (fait ponctuel, pas de
-- solde agrégé à protéger), toujours sur une session ouverte de son magasin
-- =====================================================================
create policy "cash_adjustments_select" on public.cash_adjustments
  for select using (
    public.my_role() in ('super_admin', 'manager', 'cashier')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

create policy "cash_adjustments_insert" on public.cash_adjustments
  for insert with check (
    public.my_role() in ('super_admin', 'manager', 'cashier')
    and (public.is_super_admin() or store_id = public.my_store_id())
    and exists (
      select 1 from public.cash_sessions cs
      where cs.id = cash_session_id and cs.status = 'open' and cs.store_id = cash_adjustments.store_id
    )
  );
