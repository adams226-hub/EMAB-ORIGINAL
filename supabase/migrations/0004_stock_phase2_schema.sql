-- =====================================================================
-- EMAB ERP — Phase 2 — Gestion des stocks et des mouvements
-- Schéma : enums, tables, index, vues
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

-- Chaque type porte un signe implicite et fixe (voir trigger apply_stock_movement) :
--   'in', 'transfer_in', 'adjustment_in', 'inventory_correction_in'   → +quantity
--   'out', 'transfer_out', 'adjustment_out', 'inventory_correction_out' → -quantity
create type public.movement_type as enum (
  'in',
  'out',
  'transfer_out',
  'transfer_in',
  'adjustment_in',
  'adjustment_out',
  'inventory_correction_in',
  'inventory_correction_out'
);

create type public.movement_reference_type as enum ('purchase_order', 'transfer', 'inventory', 'manual');

create type public.transfer_status as enum ('pending', 'in_transit', 'received', 'cancelled');

create type public.count_status as enum ('draft', 'submitted', 'validated', 'cancelled');

create type public.po_status as enum ('draft', 'ordered', 'partially_received', 'received', 'cancelled');

-- ---------------------------------------------------------------------
-- Table : units (unités de mesure)
-- ---------------------------------------------------------------------
create table public.units (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  abbreviation  text not null unique,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.products
  add column unit_id uuid references public.units(id) on delete set null;

-- ---------------------------------------------------------------------
-- Table : suppliers (fournisseurs)
-- ---------------------------------------------------------------------
create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  address       text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Table : stock_movements — grand livre des mouvements (append-only)
-- Aucune suppression ni modification après écriture : toute correction
-- se fait via un nouveau mouvement inverse (voir colonne reversal_of).
-- ---------------------------------------------------------------------
create table public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  type            public.movement_type not null,
  product_id      uuid not null references public.products(id),
  store_id        uuid not null references public.stores(id),
  quantity        numeric(12,2) not null check (quantity > 0),
  unit_cost       numeric(12,2),
  reference_type  public.movement_reference_type not null default 'manual',
  reference_id    uuid,
  supplier_id     uuid references public.suppliers(id),
  reason          text,
  notes           text,
  reversal_of     uuid references public.stock_movements(id),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create index idx_stock_movements_product_store on public.stock_movements(product_id, store_id);
create index idx_stock_movements_store_created on public.stock_movements(store_id, created_at desc);
create index idx_stock_movements_reference on public.stock_movements(reference_type, reference_id);

-- ---------------------------------------------------------------------
-- Table : purchase_orders (commandes fournisseurs) + items
-- ---------------------------------------------------------------------
create table public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  supplier_id   uuid not null references public.suppliers(id),
  store_id      uuid not null references public.stores(id),
  status        public.po_status not null default 'draft',
  order_date    date not null default current_date,
  expected_date date,
  notes         text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_purchase_orders_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

create index idx_purchase_orders_store on public.purchase_orders(store_id);
create index idx_purchase_orders_supplier on public.purchase_orders(supplier_id);

create table public.purchase_order_items (
  id                  uuid primary key default gen_random_uuid(),
  purchase_order_id   uuid not null references public.purchase_orders(id) on delete cascade,
  product_id          uuid not null references public.products(id),
  quantity_ordered    numeric(12,2) not null check (quantity_ordered > 0),
  quantity_received   numeric(12,2) not null default 0 check (quantity_received >= 0),
  unit_price          numeric(12,2) not null default 0 check (unit_price >= 0),

  unique (purchase_order_id, product_id),
  constraint chk_received_not_exceed_ordered check (quantity_received <= quantity_ordered)
);

-- ---------------------------------------------------------------------
-- Table : stock_transfers (transferts inter-magasins) + items
-- ---------------------------------------------------------------------
create table public.stock_transfers (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  from_store_id   uuid not null references public.stores(id),
  to_store_id     uuid not null references public.stores(id),
  status          public.transfer_status not null default 'pending',
  requested_by    uuid references public.profiles(id),
  validated_by    uuid references public.profiles(id),
  validated_at    timestamptz,
  received_by     uuid references public.profiles(id),
  received_at     timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint chk_different_stores check (to_store_id <> from_store_id)
);

create trigger trg_stock_transfers_updated_at
  before update on public.stock_transfers
  for each row execute function public.set_updated_at();

create index idx_stock_transfers_from on public.stock_transfers(from_store_id);
create index idx_stock_transfers_to on public.stock_transfers(to_store_id);

create table public.stock_transfer_items (
  id            uuid primary key default gen_random_uuid(),
  transfer_id   uuid not null references public.stock_transfers(id) on delete cascade,
  product_id    uuid not null references public.products(id),
  quantity      numeric(12,2) not null check (quantity > 0),

  unique (transfer_id, product_id)
);

-- ---------------------------------------------------------------------
-- Table : stock_counts (inventaires) + items
-- ---------------------------------------------------------------------
create table public.stock_counts (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  store_id      uuid not null references public.stores(id),
  status        public.count_status not null default 'draft',
  created_by    uuid references public.profiles(id),
  validated_by  uuid references public.profiles(id),
  validated_at  timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_stock_counts_updated_at
  before update on public.stock_counts
  for each row execute function public.set_updated_at();

create index idx_stock_counts_store on public.stock_counts(store_id);

create table public.stock_count_items (
  id                  uuid primary key default gen_random_uuid(),
  stock_count_id      uuid not null references public.stock_counts(id) on delete cascade,
  product_id          uuid not null references public.products(id),
  expected_quantity   numeric(12,2) not null default 0,
  counted_quantity    numeric(12,2),

  unique (stock_count_id, product_id)
);

-- ---------------------------------------------------------------------
-- Vues analytiques
-- ---------------------------------------------------------------------

-- Alertes de stock faible, prêtes pour affichage direct (dashboard, sidebar)
-- security_invoker = true : la vue applique la RLS de l'utilisateur qui
-- interroge, pas celle du propriétaire de la vue (sinon fuite inter-magasins).
create or replace view public.v_stock_alerts
with (security_invoker = true) as
select
  ps.product_id,
  p.name as product_name,
  p.sku,
  ps.store_id,
  s.name as store_name,
  ps.quantity,
  ps.alert_threshold
from public.product_stock ps
join public.products p on p.id = ps.product_id
join public.stores s on s.id = ps.store_id
where ps.quantity <= ps.alert_threshold
  and p.is_active = true
  and s.is_active = true;

-- Journal des mouvements enrichi (évite les jointures répétées côté client)
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
  m.supplier_id,
  sup.name as supplier_name,
  m.reason,
  m.notes,
  m.reversal_of,
  m.created_by,
  pr.full_name as created_by_name,
  m.created_at
from public.stock_movements m
join public.products p on p.id = m.product_id
join public.stores s on s.id = m.store_id
left join public.suppliers sup on sup.id = m.supplier_id
left join public.profiles pr on pr.id = m.created_by;
