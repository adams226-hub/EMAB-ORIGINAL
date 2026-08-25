-- =====================================================================
-- EMAB ERP — Trace le type de prix appliqué par ligne de vente (détail
-- ou gros), pour pouvoir distinguer les deux dans les rapports. Jusqu'ici
-- le POS choisissait le bon prix (sale_price vs wholesale_price) mais ne
-- l'enregistrait pas : impossible de savoir après coup si une ligne
-- avait été vendue en gros. Les ventes déjà enregistrées avant cette
-- migration sont marquées 'retail' par défaut (information non
-- récupérable rétroactivement).
-- =====================================================================

alter table public.sale_items
  add column sale_type text not null default 'retail' check (sale_type in ('retail', 'wholesale'));

comment on column public.sale_items.sale_type is
  'Type de prix appliqué à la ligne (détail ou gros), choisi au POS.';

-- fn_create_sale (version en vigueur depuis 0032/0033, 9 arguments avec
-- p_walkin_name/p_walkin_phone) : reprise à l'identique + sale_type par
-- ligne, tiré de p_items (défaut 'retail' si absent, compatible avec
-- tout appelant existant qui n'enverrait pas ce champ).
create or replace function public.fn_create_sale(
  p_store_id uuid,
  p_customer_id uuid,
  p_discount_percent numeric,
  p_payment_method_id uuid,
  p_amount_paid numeric,
  p_notes text,
  p_items jsonb,
  p_walkin_name text default null,
  p_walkin_phone text default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_item jsonb;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_line_total numeric(12,2);
  v_unit_cost numeric(12,2);
  v_product_id uuid;
begin
  if not public.store_in_my_tenant(p_store_id) then
    raise exception 'Magasin introuvable';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and tenant_id = public.my_tenant_id()
  ) then
    raise exception 'Client introuvable';
  end if;

  if public.my_role() not in ('super_admin', 'manager', 'cashier') then
    raise exception 'Non autorisé à enregistrer une vente';
  end if;

  if not (public.is_super_admin() or public.my_store_id() = p_store_id) then
    raise exception 'Vous ne pouvez vendre que pour votre propre magasin';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;

    if not exists (select 1 from public.products where id = v_product_id and tenant_id = public.my_tenant_id()) then
      raise exception 'Produit introuvable';
    end if;

    v_line_total := round(
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
      * (1 - coalesce((v_item->>'discount_percent')::numeric, 0) / 100.0),
      2
    );
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  v_total := round(v_subtotal * (1 - coalesce(p_discount_percent, 0) / 100.0), 2);

  if p_amount_paid > v_total then
    raise exception 'Le montant payé ne peut pas dépasser le total de la vente';
  end if;

  insert into public.sales (
    store_id, customer_id, sold_by, subtotal, discount_percent, total_amount, notes, walkin_name, walkin_phone
  )
  values (
    p_store_id, p_customer_id, auth.uid(), v_subtotal, coalesce(p_discount_percent, 0), v_total, p_notes,
    nullif(trim(p_walkin_name), ''), nullif(trim(p_walkin_phone), '')
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select purchase_price into v_unit_cost from public.products where id = (v_item->>'product_id')::uuid;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost, discount_percent, sale_type)
    values (
      v_sale.id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      coalesce(v_unit_cost, 0),
      coalesce((v_item->>'discount_percent')::numeric, 0),
      coalesce(v_item->>'sale_type', 'retail')
    );

    insert into public.stock_movements (type, product_id, store_id, quantity, reference_type, reference_id, created_by)
    values ('out', (v_item->>'product_id')::uuid, p_store_id, (v_item->>'quantity')::numeric, 'sale', v_sale.id, auth.uid());
  end loop;

  if p_amount_paid > 0 then
    insert into public.payments (type, reference_id, amount, payment_method_id, store_id, paid_by)
    values ('sale_payment', v_sale.id, p_amount_paid, p_payment_method_id, p_store_id, auth.uid());
  end if;

  select * into v_sale from public.sales where id = v_sale.id;
  return v_sale;
end;
$$;
