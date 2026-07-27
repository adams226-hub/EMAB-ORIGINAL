-- =====================================================================
-- EMAB ERP — Phase 2 — Logique métier (triggers + fonctions RPC)
-- Toute opération qui touche le stock passe par une fonction
-- SECURITY DEFINER : atomique, autorisée explicitement, et protégée
-- contre le stock négatif par la contrainte CHECK sur product_stock.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Numérotation automatique des documents (PO / transferts / inventaires)
-- ---------------------------------------------------------------------
create sequence public.purchase_order_seq;
create sequence public.transfer_seq;
create sequence public.stock_count_seq;

create or replace function public.next_document_reference(prefix text, seq_name regclass)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval(seq_name);
  return prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

alter table public.purchase_orders
  alter column reference set default public.next_document_reference('PO', 'public.purchase_order_seq');

alter table public.stock_transfers
  alter column reference set default public.next_document_reference('TR', 'public.transfer_seq');

alter table public.stock_counts
  alter column reference set default public.next_document_reference('INV', 'public.stock_count_seq');

-- ---------------------------------------------------------------------
-- Trigger : applique chaque mouvement au stock (product_stock)
-- La contrainte CHECK (quantity >= 0) sur product_stock empêche tout
-- stock négatif : si le mouvement rendrait le stock négatif, l'INSERT
-- entier échoue et le mouvement n'est jamais écrit dans le grand livre.
-- ---------------------------------------------------------------------
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric(12,2);
begin
  delta := case
    when new.type in ('in', 'transfer_in', 'adjustment_in', 'inventory_correction_in') then new.quantity
    else -new.quantity
  end;

  insert into public.product_stock (product_id, store_id, quantity)
  values (new.product_id, new.store_id, delta)
  on conflict (product_id, store_id)
  do update set quantity = public.product_stock.quantity + excluded.quantity, updated_at = now();

  return new;
end;
$$;

create trigger trg_apply_stock_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------------------------------------------------------------------
-- fn_validate_transfer : magasin source valide la demande → le stock
-- source est décrémenté immédiatement (marchandise sortie physiquement).
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

  if v_transfer.id is null then
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

-- ---------------------------------------------------------------------
-- fn_receive_transfer : magasin destination confirme la réception →
-- le stock destination est crédité.
-- ---------------------------------------------------------------------
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

  if v_transfer.id is null then
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

-- ---------------------------------------------------------------------
-- fn_cancel_transfer : uniquement tant que la marchandise n'a pas
-- quitté le magasin source (status = 'pending').
-- ---------------------------------------------------------------------
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

  if v_transfer.id is null then
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

-- ---------------------------------------------------------------------
-- fn_submit_stock_count : verrouille un inventaire une fois le comptage
-- terminé, avant validation managériale.
-- ---------------------------------------------------------------------
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

  if v_count.id is null then
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

-- ---------------------------------------------------------------------
-- fn_validate_stock_count : le gérant valide l'inventaire → écarts
-- appliqués au stock via des mouvements de correction d'inventaire.
-- ---------------------------------------------------------------------
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

  if v_count.id is null then
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

-- ---------------------------------------------------------------------
-- fn_receive_purchase_order : réception (totale ou partielle) d'une
-- commande fournisseur. p_receipts : [{ "item_id": uuid, "quantity": n, "unit_cost": n }]
-- ---------------------------------------------------------------------
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

  if v_po.id is null then
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
-- Ces fonctions bypassent la RLS (SECURITY DEFINER) et imposent leurs
-- propres vérifications d'autorisation ci-dessus : elles doivent rester
-- appelables uniquement par des utilisateurs authentifiés.
-- ---------------------------------------------------------------------
grant execute on function public.fn_validate_transfer(uuid) to authenticated;
grant execute on function public.fn_receive_transfer(uuid) to authenticated;
grant execute on function public.fn_cancel_transfer(uuid) to authenticated;
grant execute on function public.fn_submit_stock_count(uuid) to authenticated;
grant execute on function public.fn_validate_stock_count(uuid) to authenticated;
grant execute on function public.fn_receive_purchase_order(uuid, jsonb) to authenticated;
