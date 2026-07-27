-- =====================================================================
-- EMAB ERP — Suppression des modules Fournisseurs / Achats fournisseurs
-- / Dettes fournisseurs (demande explicite : retrait complet, code + DB)
-- =====================================================================

-- 1. fn_receive_purchase_order dépend du type public.purchase_orders : à retirer
--    avant la suppression de la table.
drop function if exists public.fn_receive_purchase_order(uuid, jsonb);

-- 2. fn_record_payment : ne gère plus que les encaissements clients
--    (la branche purchase_payment est retirée avec le module fournisseurs).
create or replace function public.fn_record_payment(
  p_type public.payment_type,
  p_reference_id uuid,
  p_amount numeric,
  p_payment_method_id uuid,
  p_notes text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_tenant_id uuid;
  v_amount_due numeric(12,2);
  v_payment public.payments;
begin
  if p_amount <= 0 then
    raise exception 'Le montant du paiement doit être positif';
  end if;

  if p_type = 'sale_payment' then
    select store_id, amount_due, tenant_id into v_store_id, v_amount_due, v_tenant_id
    from public.sales where id = p_reference_id for update;

    if v_store_id is null or v_tenant_id <> public.my_tenant_id() then
      raise exception 'Vente introuvable';
    end if;
    if not (public.is_super_admin() or (public.my_role() in ('manager', 'cashier') and public.my_store_id() = v_store_id)) then
      raise exception 'Non autorisé pour ce magasin';
    end if;
  else
    raise exception 'Type de paiement invalide';
  end if;

  if p_amount > v_amount_due then
    raise exception 'Le paiement (%) dépasse le solde dû (%)', p_amount, v_amount_due;
  end if;

  insert into public.payments (type, reference_id, amount, payment_method_id, store_id, paid_by, notes)
  values (p_type, p_reference_id, p_amount, p_payment_method_id, v_store_id, auth.uid(), p_notes)
  returning * into v_payment;

  return v_payment;
end;
$$;

-- 3. Vue des dettes fournisseurs : plus de raison d'être.
drop view if exists public.v_supplier_payables;

-- 4. Mouvements de stock : retrait de la colonne supplier_id (et de la vue
--    détaillée qui la référence, recréée juste après sans ce champ).
drop view if exists public.v_stock_movements_detail;

alter table public.stock_movements drop column if exists supplier_id;

create or replace view public.v_stock_movements_detail
with (security_invoker = true) as
select
  m.id,
  m.type,
  m.product_id,
  p.name as product_name,
  p.sku,
  m.store_id,
  s.name as store_name,
  m.quantity,
  m.unit_cost,
  m.reference_type,
  m.reference_id,
  m.reason,
  m.notes,
  m.reversal_of,
  m.created_by,
  pr.full_name as created_by_name,
  m.created_at
from public.stock_movements m
join public.products p on p.id = m.product_id
join public.stores s on s.id = m.store_id
left join public.profiles pr on pr.id = m.created_by;

-- 5. Suppression des tables du module achats/fournisseurs (cascade pour
--    entraîner policies, index et FK dépendants).
drop table if exists public.purchase_order_items cascade;
drop table if exists public.purchase_orders cascade;
drop table if exists public.suppliers cascade;
