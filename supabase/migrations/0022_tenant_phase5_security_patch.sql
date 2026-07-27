-- =====================================================================
-- EMAB ERP — Phase 5 — Multi-tenant SaaS : correctif de sécurité critique
--
-- Toutes les fonctions SECURITY DEFINER ci-dessous (Phases 2-3)
-- BYPASSENT la RLS par construction — c'est nécessaire à leur logique
-- métier, mais cela signifie que la nouvelle policy RESTRICTIVE
-- tenant_isolation (0020) NE LES PROTÈGE PAS. Sans ce correctif, un
-- super_admin du Tenant A pourrait, par exemple, appeler fn_create_sale
-- avec le store_id d'un magasin du Tenant B : la vérification existante
-- ("is_super_admin() OR store_id = mon magasin") laisserait passer
-- l'appel puisqu'il EST bien super_admin — simplement pas du bon tenant.
-- Chaque fonction est réécrite ici pour vérifier explicitement que
-- toute ligne ou tout identifiant reçu appartient au tenant de
-- l'appelant, AVANT toute autre logique d'autorisation par rôle.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Phase 2 — transferts, inventaires, réception d'achats
-- ---------------------------------------------------------------------

create or replace function public.fn_validate_transfer(p_transfer_id uuid)
returns public.stock_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.stock_transfers;
  v_item record;
begin
  select * into v_transfer from public.stock_transfers where id = p_transfer_id for update;

  if v_transfer.id is null or v_transfer.tenant_id <> public.my_tenant_id() then
    raise exception 'Transfert introuvable';
  end if;

  if v_transfer.status <> 'pending' then
    raise exception 'Seul un transfert en attente peut être validé';
  end if;

  if not (public.is_super_admin() or (public.my_role() = 'manager' and public.my_store_id() = v_transfer.from_store_id)) then
    raise exception 'Seul le gérant du magasin source peut valider ce transfert';
  end if;

  for v_item in select * from public.stock_transfer_items where transfer_id = p_transfer_id loop
    insert into public.stock_movements (type, product_id, store_id, quantity, reference_type, reference_id, created_by)
    values ('transfer_out', v_item.product_id, v_transfer.from_store_id, v_item.quantity, 'transfer', p_transfer_id, auth.uid());
  end loop;

  update public.stock_transfers
  set status = 'in_transit', validated_by = auth.uid(), validated_at = now()
  where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

create or replace function public.fn_receive_transfer(p_transfer_id uuid)
returns public.stock_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.stock_transfers;
  v_item record;
begin
  select * into v_transfer from public.stock_transfers where id = p_transfer_id for update;

  if v_transfer.id is null or v_transfer.tenant_id <> public.my_tenant_id() then
    raise exception 'Transfert introuvable';
  end if;

  if v_transfer.status <> 'in_transit' then
    raise exception 'Seul un transfert en transit peut être réceptionné';
  end if;

  if not (public.is_super_admin() or (public.my_role() in ('manager', 'stock_keeper') and public.my_store_id() = v_transfer.to_store_id)) then
    raise exception 'Seul le magasin destinataire peut réceptionner ce transfert';
  end if;

  for v_item in select * from public.stock_transfer_items where transfer_id = p_transfer_id loop
    insert into public.stock_movements (type, product_id, store_id, quantity, reference_type, reference_id, created_by)
    values ('transfer_in', v_item.product_id, v_transfer.to_store_id, v_item.quantity, 'transfer', p_transfer_id, auth.uid());
  end loop;

  update public.stock_transfers
  set status = 'received', received_by = auth.uid(), received_at = now()
  where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

create or replace function public.fn_cancel_transfer(p_transfer_id uuid)
returns public.stock_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.stock_transfers;
begin
  select * into v_transfer from public.stock_transfers where id = p_transfer_id for update;

  if v_transfer.id is null or v_transfer.tenant_id <> public.my_tenant_id() then
    raise exception 'Transfert introuvable';
  end if;

  if v_transfer.status <> 'pending' then
    raise exception 'Un transfert déjà en transit ou réceptionné ne peut plus être annulé';
  end if;

  if not (public.is_super_admin() or public.my_store_id() = v_transfer.from_store_id) then
    raise exception 'Non autorisé';
  end if;

  update public.stock_transfers set status = 'cancelled' where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

create or replace function public.fn_submit_stock_count(p_count_id uuid)
returns public.stock_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count public.stock_counts;
  v_incomplete int;
begin
  select * into v_count from public.stock_counts where id = p_count_id for update;

  if v_count.id is null or v_count.tenant_id <> public.my_tenant_id() then
    raise exception 'Inventaire introuvable';
  end if;

  if v_count.status <> 'draft' then
    raise exception 'Seul un inventaire en brouillon peut être soumis';
  end if;

  if not (public.is_super_admin() or public.my_store_id() = v_count.store_id) then
    raise exception 'Non autorisé';
  end if;

  select count(*) into v_incomplete from public.stock_count_items
  where stock_count_id = p_count_id and counted_quantity is null;

  if v_incomplete > 0 then
    raise exception 'Comptage incomplet : % produit(s) sans quantité comptée', v_incomplete;
  end if;

  update public.stock_counts set status = 'submitted' where id = p_count_id
  returning * into v_count;

  return v_count;
end;
$$;

create or replace function public.fn_validate_stock_count(p_count_id uuid)
returns public.stock_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count public.stock_counts;
  v_item record;
  v_delta numeric(12,2);
begin
  select * into v_count from public.stock_counts where id = p_count_id for update;

  if v_count.id is null or v_count.tenant_id <> public.my_tenant_id() then
    raise exception 'Inventaire introuvable';
  end if;

  if v_count.status <> 'submitted' then
    raise exception 'Seul un inventaire soumis peut être validé';
  end if;

  if not (public.is_super_admin() or (public.my_role() = 'manager' and public.my_store_id() = v_count.store_id)) then
    raise exception 'Seul le gérant du magasin peut valider cet inventaire';
  end if;

  for v_item in select * from public.stock_count_items where stock_count_id = p_count_id loop
    v_delta := coalesce(v_item.counted_quantity, 0) - v_item.expected_quantity;

    if v_delta > 0 then
      insert into public.stock_movements (type, product_id, store_id, quantity, reference_type, reference_id, created_by)
      values ('inventory_correction_in', v_item.product_id, v_count.store_id, v_delta, 'inventory', p_count_id, auth.uid());
    elsif v_delta < 0 then
      insert into public.stock_movements (type, product_id, store_id, quantity, reference_type, reference_id, created_by)
      values ('inventory_correction_out', v_item.product_id, v_count.store_id, -v_delta, 'inventory', p_count_id, auth.uid());
    end if;
  end loop;

  update public.stock_counts
  set status = 'validated', validated_by = auth.uid(), validated_at = now()
  where id = p_count_id
  returning * into v_count;

  return v_count;
end;
$$;

create or replace function public.fn_receive_purchase_order(p_po_id uuid, p_receipts jsonb)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po public.purchase_orders;
  v_receipt jsonb;
  v_item public.purchase_order_items;
  v_qty numeric(12,2);
  v_cost numeric(12,2);
  v_remaining int;
  v_received_any int;
begin
  select * into v_po from public.purchase_orders where id = p_po_id for update;

  if v_po.id is null or v_po.tenant_id <> public.my_tenant_id() then
    raise exception 'Commande introuvable';
  end if;

  if v_po.status not in ('ordered', 'partially_received') then
    raise exception 'Cette commande n''est pas en attente de réception';
  end if;

  if not (public.is_super_admin() or (public.my_role() in ('manager', 'stock_keeper') and public.my_store_id() = v_po.store_id)) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  for v_receipt in select * from jsonb_array_elements(p_receipts) loop
    select * into v_item from public.purchase_order_items
    where id = (v_receipt->>'item_id')::uuid and purchase_order_id = p_po_id
    for update;

    if v_item.id is null then
      raise exception 'Ligne de commande introuvable';
    end if;

    v_qty := (v_receipt->>'quantity')::numeric;
    v_cost := nullif(v_receipt->>'unit_cost', '')::numeric;

    if v_qty is null or v_qty <= 0 then
      continue;
    end if;

    update public.purchase_order_items
    set quantity_received = quantity_received + v_qty
    where id = v_item.id;

    insert into public.stock_movements
      (type, product_id, store_id, quantity, unit_cost, reference_type, reference_id, supplier_id, created_by)
    values
      ('in', v_item.product_id, v_po.store_id, v_qty, coalesce(v_cost, v_item.unit_price), 'purchase_order', p_po_id, v_po.supplier_id, auth.uid());
  end loop;

  select count(*) filter (where quantity_received < quantity_ordered) into v_remaining
  from public.purchase_order_items where purchase_order_id = p_po_id;

  select count(*) filter (where quantity_received > 0) into v_received_any
  from public.purchase_order_items where purchase_order_id = p_po_id;

  update public.purchase_orders
  set status = case
    when v_remaining = 0 then 'received'
    when v_received_any > 0 then 'partially_received'
    else status
  end
  where id = p_po_id
  returning * into v_po;

  return v_po;
end;
$$;

-- ---------------------------------------------------------------------
-- Phase 3 — ventes, paiements, caisse
-- ---------------------------------------------------------------------

create or replace function public.fn_create_sale(
  p_store_id uuid,
  p_customer_id uuid,
  p_discount_percent numeric,
  p_payment_method_id uuid,
  p_amount_paid numeric,
  p_notes text,
  p_items jsonb
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

  insert into public.sales (store_id, customer_id, sold_by, subtotal, discount_percent, total_amount, notes)
  values (p_store_id, p_customer_id, auth.uid(), v_subtotal, coalesce(p_discount_percent, 0), v_total, p_notes)
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select purchase_price into v_unit_cost from public.products where id = (v_item->>'product_id')::uuid;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost, discount_percent)
    values (
      v_sale.id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      coalesce(v_unit_cost, 0),
      coalesce((v_item->>'discount_percent')::numeric, 0)
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

create or replace function public.fn_cancel_sale(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_item record;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;

  if v_sale.id is null or v_sale.tenant_id <> public.my_tenant_id() then
    raise exception 'Vente introuvable';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'Cette vente est déjà annulée';
  end if;

  if not (public.is_super_admin() or (public.my_role() = 'manager' and public.my_store_id() = v_sale.store_id)) then
    raise exception 'Seul le gérant du magasin peut annuler cette vente';
  end if;

  for v_item in select * from public.sale_items where sale_id = p_sale_id loop
    insert into public.stock_movements (type, product_id, store_id, quantity, reference_type, reference_id, created_by)
    values ('in', v_item.product_id, v_sale.store_id, v_item.quantity, 'sale', p_sale_id, auth.uid());
  end loop;

  perform set_config('emab.trusted_write', 'on', true);

  update public.sales
  set status = 'cancelled', notes = coalesce(notes || ' — ', '') || 'Annulée : ' || coalesce(p_reason, 'non précisé')
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

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
  elsif p_type = 'purchase_payment' then
    select store_id, amount_due, tenant_id into v_store_id, v_amount_due, v_tenant_id
    from public.purchase_orders where id = p_reference_id for update;

    if v_store_id is null or v_tenant_id <> public.my_tenant_id() then
      raise exception 'Commande introuvable';
    end if;
    if not (public.is_super_admin() or (public.my_role() = 'manager' and public.my_store_id() = v_store_id)) then
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

create or replace function public.fn_open_cash_session(p_store_id uuid, p_opening_amount numeric)
returns public.cash_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.cash_sessions;
begin
  if not public.store_in_my_tenant(p_store_id) then
    raise exception 'Magasin introuvable';
  end if;

  if not (public.is_super_admin() or (public.my_role() in ('manager', 'cashier') and public.my_store_id() = p_store_id)) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if exists (select 1 from public.cash_sessions where store_id = p_store_id and status = 'open') then
    raise exception 'Une session de caisse est déjà ouverte pour ce magasin';
  end if;

  insert into public.cash_sessions (store_id, opened_by, opening_amount)
  values (p_store_id, auth.uid(), coalesce(p_opening_amount, 0))
  returning * into v_session;

  return v_session;
end;
$$;

create or replace function public.fn_close_cash_session(p_session_id uuid, p_closing_amount numeric, p_notes text)
returns public.cash_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.cash_sessions;
  v_cash_in numeric(12,2);
  v_cash_out numeric(12,2);
  v_adjust_in numeric(12,2);
  v_adjust_out numeric(12,2);
  v_expected numeric(12,2);
begin
  select * into v_session from public.cash_sessions where id = p_session_id for update;

  if v_session.id is null or v_session.tenant_id <> public.my_tenant_id() then
    raise exception 'Session de caisse introuvable';
  end if;

  if v_session.status <> 'open' then
    raise exception 'Cette session est déjà fermée';
  end if;

  if not (public.is_super_admin() or (public.my_role() in ('manager', 'cashier') and public.my_store_id() = v_session.store_id)) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  select coalesce(sum(p.amount), 0) into v_cash_in
  from public.payments p
  join public.payment_methods pm on pm.id = p.payment_method_id
  where p.store_id = v_session.store_id and pm.is_cash and p.type = 'sale_payment'
    and p.payment_date >= v_session.opened_at;

  select coalesce(sum(e.amount), 0) into v_cash_out
  from public.expenses e
  join public.payment_methods pm on pm.id = e.payment_method_id
  where e.store_id = v_session.store_id and pm.is_cash
    and e.created_at >= v_session.opened_at;

  v_cash_out := v_cash_out + coalesce((
    select sum(p.amount)
    from public.payments p
    join public.payment_methods pm on pm.id = p.payment_method_id
    where p.store_id = v_session.store_id and pm.is_cash and p.type = 'purchase_payment'
      and p.payment_date >= v_session.opened_at
  ), 0);

  select coalesce(sum(amount) filter (where type = 'in'), 0), coalesce(sum(amount) filter (where type = 'out'), 0)
  into v_adjust_in, v_adjust_out
  from public.cash_adjustments
  where cash_session_id = p_session_id;

  v_expected := v_session.opening_amount + v_cash_in - v_cash_out + v_adjust_in - v_adjust_out;

  perform set_config('emab.trusted_write', 'on', true);

  update public.cash_sessions
  set status = 'closed',
      closed_by = auth.uid(),
      closed_at = now(),
      closing_amount = p_closing_amount,
      expected_amount = v_expected,
      notes = p_notes
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$$;
