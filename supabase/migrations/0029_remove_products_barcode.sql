-- =====================================================================
-- EMAB ERP — Suppression du champ code-barre (produits sans code-barre)
-- =====================================================================

alter table public.products drop constraint if exists products_tenant_barcode_key;
alter table public.products drop column if exists barcode;
