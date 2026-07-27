-- =====================================================================
-- EMAB ERP — Phase 3 — Logique métier financière
-- =====================================================================

create sequence public.sale_seq;

alter table public.sales
  alter column reference set default public.next_document_reference('VTE', 'public.sale_seq');

-- ---------------------------------------------------------------------
-- Garde-fou : les colonnes financières sensibles (montants figés à la
-- création, solde payé) ne peuvent être modifiées que par du code
-- serveur de confiance (fonctions ci-dessous), jamais par un UPDATE
-- direct du client — même si une policy RLS l'autoriserait par ailleurs
-- pour d'autres colonnes de la même ligne (ex. statut d'une commande).
-- ---------------------------------------------------------------------
create or replace function public.guard_financial_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('emab.trusted_write', true) is distinct from 'on' then
    if new.amount_paid is distinct from old.amount_paid then
      raise exception 'amount_paid ne peut être modifié que via un paiement enregistré';
    end if;

    if TG_TABLE_NAME = 'purchase_orders' and new.total_amount is distinct from old.total_amount then
      raise exception 'total_amount est figé à la création de la commande';
    end if;

    if TG_TABLE_NAME = 'sales' and (
      new.subtotal is distinct from old.subtotal
      or new.total_amount is distinct from old.total_amount
      or new.discount_percent is distinct from old.discount_percent
    ) then
      raise exception 'Les montants d''une vente sont figés à la création';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_guard_sales_financial
  before update on public.sales
  for each row execute function public.guard_financial_columns();

create trigger trg_guard_po_financial
  before update on public.purchase_orders
  for each row execute function public.guard_financial_columns();

-- ---------------------------------------------------------------------
-- Trigger : chaque paiement met à jour automatiquement le solde de la
-- vente ou de la commande fournisseur concernée.
-- ---------------------------------------------------------------------
create or replace function public.apply_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('emab.trusted_write', 'on', true);

  if new.type = 'sale_payment' then
    update public.sales set amount_paid = amount_paid + new.amount where id = new.reference_id;
  elsif new.type = 'purchase_payment' then
    update public.purchase_orders set amount_paid = amount_paid + new.amount where id = new.reference_id;
  end if;

  return new;
end;
$$;

create trigger trg_apply_payment
  after insert on public.payments
  for each row execute function public.apply_payment();

-- ---------------------------------------------------------------------
-- fn_create_sale : point de vente — création atomique d'une vente,
-- décrémentation du stock (réutilise le trigger Phase 2
-- apply_stock_movement, qui interdit tout stock négatif) et
-- enregistrement du premier paiement le cas échéant.
-- p_items : [{ "product_id": uuid, "quantity": n, "unit_price": n, "discount_percent": n }]
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
begin
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

-- ---------------------------------------------------------------------
-- fn_cancel_sale : annule une vente et restitue le stock vendu (nouveau
-- mouvement d'entrée référencé, jamais de suppression du mouvement de
-- sortie d'origine).
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

  if v_sale.id is null then
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

-- ---------------------------------------------------------------------
-- fn_record_payment : encaissement d'une créance client ou règlement
-- d'une dette fournisseur. Fonction unique car la logique (plafonner au
-- solde dû, tracer le paiement) est identique dans les deux cas.
-- ---------------------------------------------------------------------
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
  v_amount_due numeric(12,2);
  v_payment public.payments;
begin
  if p_amount <= 0 then
    raise exception 'Le montant du paiement doit être positif';
  end if;

  if p_type = 'sale_payment' then
    select store_id, amount_due into v_store_id, v_amount_due from public.sales where id = p_reference_id for update;
    if v_store_id is null then
      raise exception 'Vente introuvable';
    end if;
    if not (public.is_super_admin() or (public.my_role() in ('manager', 'cashier') and public.my_store_id() = v_store_id)) then
      raise exception 'Non autorisé pour ce magasin';
    end if;
  elsif p_type = 'purchase_payment' then
    select store_id, amount_due into v_store_id, v_amount_due from public.purchase_orders where id = p_reference_id for update;
    if v_store_id is null then
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

-- ---------------------------------------------------------------------
-- Sessions de caisse
-- ---------------------------------------------------------------------
create or replace function public.fn_open_cash_session(p_store_id uuid, p_opening_amount numeric)
returns public.cash_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.cash_sessions;
begin
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

  if v_session.id is null then
    raise exception 'Session de caisse introuvable';
  end if;

  if v_session.status <> 'open' then
    raise exception 'Cette session est déjà fermée';
  end if;

  if not (public.is_super_admin() or (public.my_role() in ('manager', 'cashier') and public.my_store_id() = v_session.store_id)) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  -- Encaissements clients en espèces (entrée de caisse)
  select coalesce(sum(p.amount), 0) into v_cash_in
  from public.payments p
  join public.payment_methods pm on pm.id = p.payment_method_id
  where p.store_id = v_session.store_id and pm.is_cash and p.type = 'sale_payment'
    and p.payment_date >= v_session.opened_at;

  -- Sorties de caisse : dépenses réglées en espèces + fournisseurs payés en espèces
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

-- ---------------------------------------------------------------------
-- Autorisations d'exécution (bypass RLS via SECURITY DEFINER, chaque
-- fonction impose ses propres vérifications ci-dessus)
-- ---------------------------------------------------------------------
grant execute on function public.fn_create_sale(uuid, uuid, numeric, uuid, numeric, text, jsonb) to authenticated;
grant execute on function public.fn_cancel_sale(uuid, text) to authenticated;
grant execute on function public.fn_record_payment(public.payment_type, uuid, numeric, uuid, text) to authenticated;
grant execute on function public.fn_open_cash_session(uuid, numeric) to authenticated;
grant execute on function public.fn_close_cash_session(uuid, numeric, text) to authenticated;
