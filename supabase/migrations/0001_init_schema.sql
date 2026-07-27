-- =====================================================================
-- EMAB ERP — Phase 1 — Schéma initial
-- Extensions, types, tables, contraintes, triggers techniques
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.user_role as enum (
  'super_admin',   -- accès total, tous les magasins
  'manager',       -- gérant, un seul magasin
  'cashier',       -- caissier, ventes uniquement (phase 2)
  'stock_keeper'   -- magasinier, stock uniquement
);

-- ---------------------------------------------------------------------
-- Fonction utilitaire : updated_at automatique
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Table : stores (magasins)
-- ---------------------------------------------------------------------
create table public.stores (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  code         text not null unique,
  address      text,
  city         text,
  phone        text,
  email        text,
  manager_id   uuid,                       -- FK ajoutée après création de profiles
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_stores_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Table : profiles (extension de auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  phone       text,
  role        public.user_role not null default 'cashier',
  store_id    uuid references public.stores(id) on delete set null,
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- un super_admin n'est rattaché à aucun magasin unique
  constraint chk_super_admin_no_store
    check (role <> 'super_admin' or store_id is null)
);

alter table public.stores
  add constraint fk_stores_manager
  foreign key (manager_id) references public.profiles(id) on delete set null;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index idx_profiles_store_id on public.profiles(store_id);
create index idx_profiles_role on public.profiles(role);

-- ---------------------------------------------------------------------
-- Trigger : création automatique du profil à l'inscription Supabase Auth
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, store_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'cashier'),
    nullif(new.raw_user_meta_data->>'store_id', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Table : categories
-- ---------------------------------------------------------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  parent_id    uuid references public.categories(id) on delete set null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create index idx_categories_parent_id on public.categories(parent_id);

-- ---------------------------------------------------------------------
-- Table : products (catalogue global, partagé entre magasins)
-- ---------------------------------------------------------------------
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  sku             text not null unique,
  barcode         text unique,
  category_id     uuid references public.categories(id) on delete set null,
  description     text,
  unit            text not null default 'pièce',
  purchase_price  numeric(12,2) not null default 0 check (purchase_price >= 0),
  sale_price      numeric(12,2) not null default 0 check (sale_price >= 0),
  image_url       text,
  is_active       boolean not null default true,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index idx_products_category_id on public.products(category_id);
create index idx_products_sku on public.products(sku);
create index idx_products_name_trgm on public.products using gin (to_tsvector('simple', name));

-- ---------------------------------------------------------------------
-- Table : product_stock (stock du produit par magasin)
-- Prépare la Phase 2 (mouvements de stock, ventes) sans la construire.
-- ---------------------------------------------------------------------
create table public.product_stock (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products(id) on delete cascade,
  store_id         uuid not null references public.stores(id) on delete cascade,
  quantity         numeric(12,2) not null default 0 check (quantity >= 0),
  alert_threshold  numeric(12,2) not null default 5,
  updated_at       timestamptz not null default now(),

  unique (product_id, store_id)
);

create trigger trg_product_stock_updated_at
  before update on public.product_stock
  for each row execute function public.set_updated_at();

create index idx_product_stock_store_id on public.product_stock(store_id);
create index idx_product_stock_product_id on public.product_stock(product_id);

-- ---------------------------------------------------------------------
-- Vue : produits avec stock total (utile pour le dashboard)
-- ---------------------------------------------------------------------
create or replace view public.v_products_overview as
select
  p.id,
  p.name,
  p.sku,
  p.category_id,
  c.name as category_name,
  p.sale_price,
  p.purchase_price,
  p.is_active,
  coalesce(sum(ps.quantity), 0) as total_stock,
  count(ps.store_id) filter (where ps.quantity <= ps.alert_threshold) as stores_low_stock
from public.products p
left join public.categories c on c.id = p.category_id
left join public.product_stock ps on ps.product_id = p.id
group by p.id, c.name;
