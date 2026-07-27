-- =====================================================================
-- EMAB ERP — Phase 1 — Row Level Security
-- Chaque rôle ne voit / modifie que ce qu'il est autorisé à voir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fonctions utilitaires (SECURITY DEFINER pour éviter la récursion RLS)
-- ---------------------------------------------------------------------
create or replace function public.my_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_store_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select store_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.my_role() = 'super_admin';
$$;

-- ---------------------------------------------------------------------
-- Activation RLS
-- ---------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_stock enable row level security;

-- =====================================================================
-- PROFILES
-- =====================================================================
-- Lecture : soi-même, ou tout le monde si super_admin, ou même magasin si manager
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_super_admin()
    or (public.my_role() = 'manager' and store_id = public.my_store_id())
  );

-- Création : uniquement super_admin (création des comptes utilisateurs)
create policy "profiles_insert_super_admin" on public.profiles
  for insert with check (public.is_super_admin());

-- Mise à jour : soi-même (profil limité) ou super_admin (tout)
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid() or public.is_super_admin());

-- Suppression : super_admin uniquement
create policy "profiles_delete_super_admin" on public.profiles
  for delete using (public.is_super_admin());

-- =====================================================================
-- STORES
-- =====================================================================
-- Lecture : super_admin voit tout, les autres voient uniquement leur magasin
create policy "stores_select" on public.stores
  for select using (
    public.is_super_admin()
    or id = public.my_store_id()
  );

-- Écriture (create/update/delete) : super_admin uniquement
create policy "stores_insert_super_admin" on public.stores
  for insert with check (public.is_super_admin());

create policy "stores_update_super_admin" on public.stores
  for update using (public.is_super_admin());

create policy "stores_delete_super_admin" on public.stores
  for delete using (public.is_super_admin());

-- =====================================================================
-- CATEGORIES (référentiel global, partagé par tous les magasins)
-- =====================================================================
create policy "categories_select_authenticated" on public.categories
  for select using (auth.role() = 'authenticated');

create policy "categories_write_admin_manager" on public.categories
  for insert with check (public.my_role() in ('super_admin', 'manager'));

create policy "categories_update_admin_manager" on public.categories
  for update using (public.my_role() in ('super_admin', 'manager'));

create policy "categories_delete_super_admin" on public.categories
  for delete using (public.is_super_admin());

-- =====================================================================
-- PRODUCTS (catalogue global)
-- =====================================================================
create policy "products_select_authenticated" on public.products
  for select using (auth.role() = 'authenticated');

create policy "products_write_admin_manager_stock" on public.products
  for insert with check (public.my_role() in ('super_admin', 'manager', 'stock_keeper'));

create policy "products_update_admin_manager_stock" on public.products
  for update using (public.my_role() in ('super_admin', 'manager', 'stock_keeper'));

create policy "products_delete_super_admin" on public.products
  for delete using (public.is_super_admin());

-- =====================================================================
-- PRODUCT_STOCK (stock par magasin — cœur de l'isolation multi-magasin)
-- =====================================================================
create policy "product_stock_select" on public.product_stock
  for select using (
    public.is_super_admin()
    or store_id = public.my_store_id()
  );

create policy "product_stock_write" on public.product_stock
  for insert with check (
    public.my_role() in ('super_admin', 'manager', 'stock_keeper')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

create policy "product_stock_update" on public.product_stock
  for update using (
    public.my_role() in ('super_admin', 'manager', 'stock_keeper')
    and (public.is_super_admin() or store_id = public.my_store_id())
  );

create policy "product_stock_delete_super_admin" on public.product_stock
  for delete using (public.is_super_admin());
