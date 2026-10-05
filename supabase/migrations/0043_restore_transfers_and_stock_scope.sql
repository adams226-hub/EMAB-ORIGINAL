-- =====================================================================
-- EMAB ERP — Reconstruction du module Transferts entre magasins (retiré
-- par 0028), et extension du périmètre "tous les magasins" au rôle
-- Magasinier pour tout ce qui concerne le stock (vue d'ensemble,
-- entrées, mouvements, inventaires, transferts) — il reste limité à son
-- magasin pour tout le reste (ventes, etc.). "Sorties de stock" devient
-- réservé au Super Admin uniquement.
--
-- movement_type (transfer_in/transfer_out) et movement_reference_type
-- ('transfer') existent toujours : seules la table et les fonctions
-- avaient été supprimées par 0028, pas les enums.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables : stock_transfers / stock_transfer_items
-- ---------------------------------------------------------------------
create sequence public.transfer_seq;

create table public.stock_transfers (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique default public.next_document_reference('TR', 'public.transfer_seq'),
  from_store_id   uuid not null references public.stores(id),
  to_store_id     uuid not null references public.stores(id),
  status          public.transfer_status not null default 'pending',
  requested_by    uuid references public.profiles(id),
  validated_by    uuid references public.profiles(id),
  validated_at    timestamptz,
  received_by     uuid references public.profiles(id),
  received_at     timestamptz,
  notes           text,
  tenant_id       uuid not null references public.tenants(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint chk_different_stores check (to_store_id <> from_store_id)
);

create trigger trg_stock_transfers_updated_at
  before update on public.stock_transfers
  for each row execute function public.set_updated_at();

create trigger trg_set_tenant_id
  before insert on public.stock_transfers
  for each row execute function public.set_tenant_id();

create index idx_stock_transfers_from on public.stock_transfers(from_store_id);
create index idx_stock_transfers_to on public.stock_transfers(to_store_id);
create index idx_stock_transfers_tenant on public.stock_transfers(tenant_id);

create table public.stock_transfer_items (
  id            uuid primary key default gen_random_uuid(),
  transfer_id   uuid not null references public.stock_transfers(id) on delete cascade,
  product_id    uuid not null references public.products(id),
  quantity      numeric(12,2) not null check (quantity > 0),
  tenant_id     uuid not null references public.tenants(id),

  unique (transfer_id, product_id)
);

create trigger trg_set_tenant_id
  before insert on public.stock_transfer_items
  for each row execute function public.set_tenant_id();

create index idx_stock_transfer_items_tenant on public.stock_transfer_items(tenant_id);

-- ---------------------------------------------------------------------
-- RLS : stock_transfers / stock_transfer_items
-- Visible par les deux magasins concernés (source et destination), le
-- Gérant et le Magasinier voient/opèrent sur tous les magasins.
-- ---------------------------------------------------------------------
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;

create policy tenant_isolation on public.stock_transfers
  as restrictive for all
  using (tenant_id = public.my_tenant_id())
  with check (tenant_id = public.my_tenant_id());

create policy tenant_isolation on public.stock_transfer_items
  as restrictive for all
  using (tenant_id = public.my_tenant_id())
  with check (tenant_id = public.my_tenant_id());

create policy stock_transfers_select on public.stock_transfers
  for select using (
    public.is_super_admin()
    or public.my_role() in ('manager', 'stock_keeper')
    or from_store_id = public.my_store_id()
    or to_store_id = public.my_store_id()
  );

create policy stock_transfers_insert on public.stock_transfers
  for insert with check (
    public.my_role() in ('super_admin', 'manager', 'stock_keeper')
    and (
      public.is_super_admin()
      or public.my_role() in ('manager', 'stock_keeper')
      or from_store_id = public.my_store_id()
    )
  );

-- La transition de statut (valider/réceptionner/annuler) passe
-- exclusivement par les fonctions RPC dédiées. Aucune policy UPDATE
-- ouverte ici.

create policy stock_transfer_items_select on public.stock_transfer_items
  for select using (
    exists (
      select 1 from public.stock_transfers t
      where t.id = transfer_id
        and (
          public.is_super_admin()
          or public.my_role() in ('manager', 'stock_keeper')
          or t.from_store_id = public.my_store_id()
          or t.to_store_id = public.my_store_id()
        )
    )
  );

create policy stock_transfer_items_insert on public.stock_transfer_items
  for insert with check (
    exists (
      select 1 from public.stock_transfers t
      where t.id = transfer_id
        and t.status = 'pending'
        and (
          public.is_super_admin()
          or public.my_role() in ('manager', 'stock_keeper')
          or t.from_store_id = public.my_store_id()
        )
    )
  );

-- ---------------------------------------------------------------------
-- Fonctions : cycle de vie du transfert
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

  if not (public.is_super_admin() or public.my_role() in ('manager', 'stock_keeper')) then
    raise exception 'Seul le magasin source peut valider ce transfert';
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

  if not (public.is_super_admin() or public.my_role() in ('manager', 'stock_keeper')) then
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

  if not (public.is_super_admin() or public.my_role() in ('manager', 'stock_keeper')) then
    raise exception 'Non autorisé à annuler ce transfert';
  end if;

  update public.stock_transfers set status = 'cancelled' where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

grant execute on function public.fn_validate_transfer(uuid) to authenticated;
grant execute on function public.fn_receive_transfer(uuid) to authenticated;
grant execute on function public.fn_cancel_transfer(uuid) to authenticated;

-- =====================================================================
-- Extension du périmètre "tous les magasins" au Magasinier pour les
-- modules de stock (hors Sorties, réservées au Super Admin).
-- =====================================================================

alter policy product_stock_select on public.product_stock
  using (is_super_admin() or my_role() in ('manager', 'stock_keeper') or store_id = my_store_id());

alter policy product_stock_update on public.product_stock
  using (
    (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'stock_keeper'::user_role]))
    and (is_super_admin() or my_role() in ('manager', 'stock_keeper') or store_id = my_store_id())
  );

alter policy product_stock_write on public.product_stock
  with check (
    (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'stock_keeper'::user_role]))
    and (is_super_admin() or my_role() in ('manager', 'stock_keeper') or store_id = my_store_id())
  );

alter policy stores_select on public.stores
  using (is_super_admin() or my_role() in ('manager', 'stock_keeper') or id = my_store_id());

alter policy stock_counts_select on public.stock_counts
  using (is_super_admin() or my_role() in ('manager', 'stock_keeper') or store_id = my_store_id());

alter policy stock_counts_insert on public.stock_counts
  with check (
    (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'cashier'::user_role, 'stock_keeper'::user_role]))
    and (is_super_admin() or my_role() in ('manager', 'stock_keeper') or store_id = my_store_id())
  );

alter policy stock_count_items_select on public.stock_count_items
  using (
    exists (
      select 1 from stock_counts c
      where c.id = stock_count_items.stock_count_id
        and (is_super_admin() or my_role() in ('manager', 'stock_keeper') or c.store_id = my_store_id())
    )
  );

alter policy stock_count_items_insert on public.stock_count_items
  with check (
    exists (
      select 1 from stock_counts c
      where c.id = stock_count_items.stock_count_id
        and c.status = 'draft'::count_status
        and (is_super_admin() or my_role() in ('manager', 'stock_keeper') or c.store_id = my_store_id())
    )
  );

alter policy stock_count_items_update on public.stock_count_items
  using (
    exists (
      select 1 from stock_counts c
      where c.id = stock_count_items.stock_count_id
        and c.status = 'draft'::count_status
        and (is_super_admin() or my_role() in ('manager', 'stock_keeper') or c.store_id = my_store_id())
    )
  );

-- stock_movements_select : visibilité étendue au Magasinier sur tous
-- les magasins (lecture seule ici, l'écriture est gérée ci-dessous).
alter policy stock_movements_select on public.stock_movements
  using (is_super_admin() or my_role() in ('manager', 'stock_keeper') or store_id = my_store_id());

-- stock_movements_insert_manual : les Sorties ('out') deviennent
-- réservées au Super Admin ; les autres mouvements manuels (Entrées,
-- Ajustements) restent ouverts à Gérant/Magasinier, désormais sur tous
-- les magasins.
alter policy stock_movements_insert_manual on public.stock_movements
  with check (
    (reference_type = 'manual'::movement_reference_type)
    and (
      (type = 'out'::movement_type and is_super_admin())
      or (
        type <> 'out'::movement_type
        and (is_super_admin() or my_role() = any (array['manager'::user_role, 'stock_keeper'::user_role]))
      )
    )
  );

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

  if not (
    public.is_super_admin()
    or public.my_role() in ('manager', 'stock_keeper')
    or public.my_store_id() = v_count.store_id
  ) then
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

  if not (
    public.is_super_admin()
    or public.my_role() in ('manager', 'stock_keeper')
    or (public.my_role() = 'cashier' and public.my_store_id() = v_count.store_id)
  ) then
    raise exception 'Non autorisé à valider cet inventaire';
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
