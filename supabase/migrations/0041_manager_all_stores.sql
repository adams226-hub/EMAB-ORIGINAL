-- =====================================================================
-- EMAB ERP — Le Gérant (manager) opère désormais sur TOUS les magasins
-- de son entreprise, comme le Super Admin, au lieu d'être restreint à
-- son magasin assigné. Caissier et Magasinier restent limités à leur
-- magasin. Aucun droit d'administration (Magasins/Utilisateurs/Finances)
-- n'est accordé au passage — uniquement le périmètre des données
-- opérationnelles déjà accessibles au Gérant (ventes, stock, clients).
--
-- Chaque politique/fonction ci-dessous est reprise à l'identique depuis
-- son état actuel en production (vérifié via pg_policies /
-- pg_get_functiondef), en ajoutant `my_role() = 'manager'` comme
-- alternative au test `store_id = my_store_id()`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- RLS : politiques de lecture/écriture par magasin
-- ---------------------------------------------------------------------
alter policy payments_select on public.payments
  using (
    (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()))
    and (
      ((type = 'sale_payment'::payment_type) and (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'cashier'::user_role])))
      or ((type = 'purchase_payment'::payment_type) and (my_role() = any (array['super_admin'::user_role, 'manager'::user_role])))
    )
  );

alter policy product_stock_select on public.product_stock
  using (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()));

alter policy product_stock_update on public.product_stock
  using (
    (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'stock_keeper'::user_role]))
    and (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()))
  );

alter policy product_stock_write on public.product_stock
  with check (
    (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'stock_keeper'::user_role]))
    and (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()))
  );

-- Le Gérant voit désormais les profils de tous les magasins (nécessaire
-- pour afficher correctement "servi par" sur les ventes des autres
-- magasins, et gérer le personnel de tous ses magasins).
alter policy profiles_select on public.profiles
  using ((id = auth.uid()) or is_super_admin() or (my_role() = 'manager'::user_role));

alter policy sale_items_select on public.sale_items
  using (
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'cashier'::user_role])
        and (is_super_admin() or my_role() = 'manager'::user_role or (s.store_id = my_store_id()))
    )
  );

alter policy sales_select on public.sales
  using (
    (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'cashier'::user_role]))
    and (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()))
  );

alter policy stock_count_items_insert on public.stock_count_items
  with check (
    exists (
      select 1 from stock_counts c
      where c.id = stock_count_items.stock_count_id
        and c.status = 'draft'::count_status
        and (is_super_admin() or my_role() = 'manager'::user_role or (c.store_id = my_store_id()))
    )
  );

alter policy stock_count_items_select on public.stock_count_items
  using (
    exists (
      select 1 from stock_counts c
      where c.id = stock_count_items.stock_count_id
        and (is_super_admin() or my_role() = 'manager'::user_role or (c.store_id = my_store_id()))
    )
  );

alter policy stock_count_items_update on public.stock_count_items
  using (
    exists (
      select 1 from stock_counts c
      where c.id = stock_count_items.stock_count_id
        and c.status = 'draft'::count_status
        and (is_super_admin() or my_role() = 'manager'::user_role or (c.store_id = my_store_id()))
    )
  );

alter policy stock_counts_insert on public.stock_counts
  with check (
    (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'stock_keeper'::user_role]))
    and (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()))
  );

alter policy stock_counts_select on public.stock_counts
  using (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()));

alter policy stock_movements_insert_manual on public.stock_movements
  with check (
    (reference_type = 'manual'::movement_reference_type)
    and (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'stock_keeper'::user_role]))
    and (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()))
  );

alter policy stock_movements_select on public.stock_movements
  using (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()));

-- Le Gérant voit tous les magasins de son entreprise (nécessaire pour
-- choisir un magasin au Point de vente, aux mouvements de stock, etc.).
alter policy stores_select on public.stores
  using (is_super_admin() or my_role() = 'manager'::user_role or (id = my_store_id()));

-- ---------------------------------------------------------------------
-- Fonctions : suppression de la contrainte "propre magasin" pour le
-- Gérant, sans toucher aux autres vérifications (rôle, tenant, etc.)
-- ---------------------------------------------------------------------
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

  if not (public.is_super_admin() or public.my_role() = 'manager') then
    raise exception 'Seul le gérant peut annuler cette vente';
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
  p_type payment_type,
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
    if not (public.is_super_admin() or public.my_role() = 'manager' or (public.my_role() = 'cashier' and public.my_store_id() = v_store_id)) then
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

  if not (public.is_super_admin() or public.my_role() = 'manager' or public.my_store_id() = v_count.store_id) then
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

  if not (public.is_super_admin() or public.my_role() = 'manager') then
    raise exception 'Seul le gérant peut valider cet inventaire';
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

create or replace function public.fn_create_sale(
  p_store_id uuid,
  p_customer_id uuid,
  p_discount_amount numeric,
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
  v_line_discount numeric(12,2);
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

  if not (public.is_super_admin() or public.my_role() = 'manager' or public.my_store_id() = p_store_id) then
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

    v_line_discount := coalesce((v_item->>'discount_amount')::numeric, 0);
    if v_line_discount > (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric then
      raise exception 'La remise d''une ligne ne peut pas dépasser son montant';
    end if;

    v_line_total := round(
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric - v_line_discount,
      2
    );
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if coalesce(p_discount_amount, 0) > v_subtotal then
    raise exception 'La remise globale ne peut pas dépasser le sous-total de la vente';
  end if;

  v_total := round(v_subtotal - coalesce(p_discount_amount, 0), 2);

  if p_amount_paid > v_total then
    raise exception 'Le montant payé ne peut pas dépasser le total de la vente';
  end if;

  insert into public.sales (
    store_id, customer_id, sold_by, subtotal, discount_amount, total_amount, notes, walkin_name, walkin_phone
  )
  values (
    p_store_id, p_customer_id, auth.uid(), v_subtotal, coalesce(p_discount_amount, 0), v_total, p_notes,
    nullif(trim(p_walkin_name), ''), nullif(trim(p_walkin_phone), '')
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select purchase_price into v_unit_cost from public.products where id = (v_item->>'product_id')::uuid;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost, discount_amount, sale_type)
    values (
      v_sale.id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      coalesce(v_unit_cost, 0),
      coalesce((v_item->>'discount_amount')::numeric, 0),
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
