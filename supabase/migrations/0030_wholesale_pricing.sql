-- =====================================================================
-- EMAB ERP — Ajout du prix de gros (vente en gros vs vente au détail)
-- wholesale_price est optionnel : s'il n'est pas défini, seul le prix
-- de détail (sale_price) est disponible pour ce produit.
-- =====================================================================

alter table public.products
  add column wholesale_price numeric(12,2) check (wholesale_price is null or wholesale_price >= 0);

comment on column public.products.wholesale_price is
  'Prix de vente en gros (optionnel). Si NULL, le produit ne se vend qu''au détail.';
