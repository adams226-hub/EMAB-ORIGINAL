-- =====================================================================
-- EMAB ERP — Retire au rôle "manager" (Gérant) l'accès aux modes de
-- paiement (demande explicite : le Gérant reste limité aux modules
-- opérationnels de son magasin — vente, stock, catalogue, rapports de
-- vente — les finances/paiements restent réservés au super_admin).
-- Le Dashboard financier et les Rapports financiers ne touchent aucune
-- policy RLS dédiée (ils lisent sales/sale_items, déjà accessibles au
-- manager pour d'autres pages) : leur retrait est géré uniquement au
-- niveau applicatif (permissions.ts, middleware, requireRole).
-- =====================================================================

drop policy if exists "payment_methods_write_admin_manager" on public.payment_methods;
drop policy if exists "payment_methods_update_admin_manager" on public.payment_methods;

create policy "payment_methods_write_super_admin" on public.payment_methods
  for insert with check (public.is_super_admin());

create policy "payment_methods_update_super_admin" on public.payment_methods
  for update using (public.is_super_admin());
