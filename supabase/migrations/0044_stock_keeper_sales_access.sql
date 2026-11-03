-- =====================================================================
-- EMAB ERP — Le Magasinier (stock_keeper) peut désormais consulter les
-- ventes (liste, détail, rapport, export) sur TOUS les magasins, comme
-- le Gérant. Il ne gagne aucun droit d'écriture (annulation, paiement) :
-- uniquement la lecture. Les paiements de type achat (purchase_payment),
-- réservés aux finances, restent hors de son périmètre.
-- =====================================================================

alter policy sales_select on public.sales
  using (
    (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'cashier'::user_role, 'stock_keeper'::user_role]))
    and (is_super_admin() or my_role() = any (array['manager'::user_role, 'stock_keeper'::user_role]) or (store_id = my_store_id()))
  );

alter policy sale_items_select on public.sale_items
  using (
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'cashier'::user_role, 'stock_keeper'::user_role])
        and (is_super_admin() or my_role() = any (array['manager'::user_role, 'stock_keeper'::user_role]) or (s.store_id = my_store_id()))
    )
  );

alter policy payments_select on public.payments
  using (
    (is_super_admin() or my_role() = any (array['manager'::user_role, 'stock_keeper'::user_role]) or (store_id = my_store_id()))
    and (
      ((type = 'sale_payment'::payment_type) and (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'cashier'::user_role, 'stock_keeper'::user_role])))
      or ((type = 'purchase_payment'::payment_type) and (my_role() = any (array['super_admin'::user_role, 'manager'::user_role])))
    )
  );
