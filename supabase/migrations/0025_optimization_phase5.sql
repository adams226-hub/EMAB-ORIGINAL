-- =====================================================================
-- EMAB ERP — Phase 5 — Optimisation base de données
--
-- 1) Correctif d'unicité : plusieurs contraintes UNIQUE des Phases 1-3
--    étaient globales (ex. un SKU unique pour TOUTE la plateforme).
--    En multi-tenant réel, deux entreprises clientes différentes
--    doivent pouvoir utiliser le même code produit, le même code
--    magasin, etc. On les rend uniques PAR TENANT.
-- 2) Index composites (tenant_id, ...) alignés sur le prédicat de la
--    policy RESTRICTIVE tenant_isolation + les filtres réels de l'app,
--    pour que chaque requête reste un index scan, pas un sequential
--    scan, même avec des dizaines de milliers de lignes par tenant.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Contraintes d'unicité re-scopées par tenant
-- ---------------------------------------------------------------------
alter table public.stores drop constraint if exists stores_code_key;
alter table public.stores add constraint stores_tenant_code_key unique (tenant_id, code);

alter table public.products drop constraint if exists products_sku_key;
alter table public.products add constraint products_tenant_sku_key unique (tenant_id, sku);

alter table public.products drop constraint if exists products_barcode_key;
alter table public.products add constraint products_tenant_barcode_key unique (tenant_id, barcode);

alter table public.categories drop constraint if exists categories_slug_key;
alter table public.categories add constraint categories_tenant_slug_key unique (tenant_id, slug);

alter table public.units drop constraint if exists units_name_key;
alter table public.units add constraint units_tenant_name_key unique (tenant_id, name);

alter table public.units drop constraint if exists units_abbreviation_key;
alter table public.units add constraint units_tenant_abbreviation_key unique (tenant_id, abbreviation);

alter table public.payment_methods drop constraint if exists payment_methods_name_key;
alter table public.payment_methods add constraint payment_methods_tenant_name_key unique (tenant_id, name);

alter table public.expense_categories drop constraint if exists expense_categories_name_key;
alter table public.expense_categories add constraint expense_categories_tenant_name_key unique (tenant_id, name);

-- ---------------------------------------------------------------------
-- 2) Index composites pour les parcours les plus fréquents
-- ---------------------------------------------------------------------
create index if not exists idx_sales_tenant_date on public.sales(tenant_id, sale_date desc);
create index if not exists idx_sales_tenant_store_date on public.sales(tenant_id, store_id, sale_date desc);
create index if not exists idx_stock_movements_tenant_store_date on public.stock_movements(tenant_id, store_id, created_at desc);
create index if not exists idx_payments_tenant_store_date on public.payments(tenant_id, store_id, payment_date desc);
create index if not exists idx_expenses_tenant_store_date on public.expenses(tenant_id, store_id, expense_date desc);
create index if not exists idx_products_tenant_active on public.products(tenant_id, is_active);
create index if not exists idx_profiles_tenant_role on public.profiles(tenant_id, role);
create index if not exists idx_product_stock_tenant_store on public.product_stock(tenant_id, store_id);

-- Recherche produit par nom (POS, import) : accélère ILIKE '%terme%'
-- sur de gros catalogues sans scan complet, y compris pour une
-- correspondance au milieu du texte (contrairement à un index B-tree).
create extension if not exists pg_trgm;
create index if not exists idx_products_name_trgm_v2 on public.products using gin (name gin_trgm_ops);
