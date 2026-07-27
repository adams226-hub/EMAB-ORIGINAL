-- =====================================================================
-- EMAB ERP — Phase 2 — Row Level Security
-- =====================================================================

-- Correctif Phase 1 : sans security_invoker, une vue s'exécute avec les
-- droits de son propriétaire et peut contourner la RLS des tables
-- qu'elle agrège (fuite de stock inter-magasins). À appliquer même si
-- 0001_init_schema.sql a déjà été exécuté.
alter view public.v_products_overview set (security_invoker = true);

alter table public.units enable row level security;
alter table public.suppliers enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;

-- =====================================================================
-- UNITS — référentiel global, lecture pour tous, écriture admin/gérant
-- =====================================================================
create policy "units_select_authenticated" on public.units
  for select using (auth.role() = 'authenticated');

create policy "units_write_admin_manager" on public.units
  for insert with check (public.my_role() in ('super_admin', 'manager'));

create policy "units_update_admin_manager" on public.units
  for update using (public.my_role() in ('super_admin', 'manager'));

create policy "units_delete_super_admin" on public.units
  for delete using (public.is_super_admin());

-- =====================================================================
-- SUPPLIERS — lecture pour tous les rôles stock, écriture admin/gérant
-- =====================================================================
create policy "suppliers_select_authenticated" on public.suppliers
  for select using (auth.role() = 'authenticated');

create policy "suppliers_write_admin_manager" on public.suppliers
  for insert with check (public.my_role() in ('super_admin', 'manager'));

create policy "suppliers_update_admin_manager" on public.suppliers
  for update using (public.my_role() in ('super_admin', 'manager'));

create policy "suppliers_delete_super_admin" on public.suppliers
  for delete using (public.is_super_admin());

-- =====================================================================
-- STOCK_MOVEMENTS — grand livre, isolé par magasin, jamais modifié/supprimé
-- =====================================================================
create policy "stock_movements_select" on public.stock_movements
  for select using (
    public.is_super_admin() or store_id = public.my_store_id()
  );

-- Insertion directe réservée aux mouvements manuels (entrée/sortie/ajustement).
-- Les mouvements liés à un transfert/inventaire/commande sont créés par les
-- fonctions SECURITY DEFINER (fn_validate_transfer, fn_receive_purchase_order, ...)
-- qui contournent cette policy tout en imposant leurs propres vérifications.
create policy "stock_movements_insert_manual" on public.stock_movements
  for insert with check (
    reference_type = 'manual'
    and public.my_role() in ('super_admin', 'manager', 'stock_keeper')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

-- Aucune policy UPDATE / DELETE : le grand livre est immuable par construction.

-- =====================================================================
-- PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS
-- Lecture : magasin concerné. Écriture (hors réception) : admin/gérant.
-- La réception passe par fn_receive_purchase_order (magasinier inclus).
-- =====================================================================
create policy "purchase_orders_select" on public.purchase_orders
  for select using (
    public.is_super_admin() or store_id = public.my_store_id()
  );

create policy "purchase_orders_insert" on public.purchase_orders
  for insert with check (
    public.my_role() in ('super_admin', 'manager')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

create policy "purchase_orders_update" on public.purchase_orders
  for update using (
    public.my_role() in ('super_admin', 'manager')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

create policy "purchase_order_items_select" on public.purchase_order_items
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and (public.is_super_admin() or po.store_id = public.my_store_id())
    )
  );

create policy "purchase_order_items_insert" on public.purchase_order_items
  for insert with check (
    public.my_role() in ('super_admin', 'manager')
    and exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and (public.is_super_admin() or po.store_id = public.my_store_id())
    )
  );

create policy "purchase_order_items_delete" on public.purchase_order_items
  for delete using (
    public.my_role() in ('super_admin', 'manager')
    and exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and po.status = 'draft'
        and (public.is_super_admin() or po.store_id = public.my_store_id())
    )
  );

-- =====================================================================
-- STOCK_TRANSFERS / STOCK_TRANSFER_ITEMS
-- Visible par les deux magasins concernés (source et destination).
-- =====================================================================
create policy "stock_transfers_select" on public.stock_transfers
  for select using (
    public.is_super_admin()
    or from_store_id = public.my_store_id()
    or to_store_id = public.my_store_id()
  );

create policy "stock_transfers_insert" on public.stock_transfers
  for insert with check (
    public.my_role() in ('super_admin', 'manager', 'stock_keeper')
    and (public.is_super_admin() or from_store_id = public.my_store_id())
  );

-- La transition de statut (valider/réceptionner/annuler) passe exclusivement
-- par les fonctions RPC dédiées, qui vérifient elles-mêmes l'autorisation.
-- Aucune policy UPDATE ouverte ici : un client ne peut pas changer le statut
-- à la main, uniquement via fn_validate_transfer / fn_receive_transfer / fn_cancel_transfer.

create policy "stock_transfer_items_select" on public.stock_transfer_items
  for select using (
    exists (
      select 1 from public.stock_transfers t
      where t.id = transfer_id
        and (public.is_super_admin() or t.from_store_id = public.my_store_id() or t.to_store_id = public.my_store_id())
    )
  );

create policy "stock_transfer_items_insert" on public.stock_transfer_items
  for insert with check (
    exists (
      select 1 from public.stock_transfers t
      where t.id = transfer_id
        and t.status = 'pending'
        and (public.is_super_admin() or t.from_store_id = public.my_store_id())
    )
  );

-- =====================================================================
-- STOCK_COUNTS / STOCK_COUNT_ITEMS
-- =====================================================================
create policy "stock_counts_select" on public.stock_counts
  for select using (
    public.is_super_admin() or store_id = public.my_store_id()
  );

create policy "stock_counts_insert" on public.stock_counts
  for insert with check (
    public.my_role() in ('super_admin', 'manager', 'stock_keeper')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

-- La validation (draft → submitted → validated) passe par fn_submit_stock_count
-- et fn_validate_stock_count. Pas de policy UPDATE ouverte sur le statut.

create policy "stock_count_items_select" on public.stock_count_items
  for select using (
    exists (
      select 1 from public.stock_counts c
      where c.id = stock_count_id
        and (public.is_super_admin() or c.store_id = public.my_store_id())
    )
  );

create policy "stock_count_items_insert" on public.stock_count_items
  for insert with check (
    exists (
      select 1 from public.stock_counts c
      where c.id = stock_count_id
        and c.status = 'draft'
        and (public.is_super_admin() or c.store_id = public.my_store_id())
    )
  );

create policy "stock_count_items_update" on public.stock_count_items
  for update using (
    exists (
      select 1 from public.stock_counts c
      where c.id = stock_count_id
        and c.status = 'draft'
        and (public.is_super_admin() or c.store_id = public.my_store_id())
    )
  );
