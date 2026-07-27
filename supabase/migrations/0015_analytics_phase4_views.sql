-- =====================================================================
-- EMAB ERP — Phase 4 — Vues analytiques (Business Intelligence)
-- Aucune nouvelle table : la BI se lit entièrement à partir des faits
-- déjà enregistrés (ventes, mouvements, dépenses) des Phases 1-3.
-- security_invoker = true partout : un gérant qui interroge ces vues
-- n'obtient que les données de son propre magasin (RLS déjà en place
-- sur sales/sale_items), sans aucune logique de filtrage supplémentaire.
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_product_performance : performance vie entière par produit
-- (ventes, coût, marge). Sert de base aux rapports "meilleures ventes"
-- et "produits les moins rentables". Les filtres par période sont
-- appliqués à la volée dans les pages de rapport (requêtes dédiées),
-- cette vue couvre la vue d'ensemble "toutes périodes confondues".
-- ---------------------------------------------------------------------
create or replace view public.v_product_performance
with (security_invoker = true) as
select
  p.id as product_id,
  p.name as product_name,
  p.sku,
  p.category_id,
  c.name as category_name,
  p.is_active,
  coalesce(sum(si.quantity) filter (where s.status = 'completed'), 0) as total_quantity_sold,
  coalesce(sum(si.line_total) filter (where s.status = 'completed'), 0) as total_revenue,
  coalesce(sum(si.quantity * si.unit_cost) filter (where s.status = 'completed'), 0) as total_cost,
  coalesce(sum(si.line_total) filter (where s.status = 'completed'), 0)
    - coalesce(sum(si.quantity * si.unit_cost) filter (where s.status = 'completed'), 0) as margin,
  max(s.sale_date) filter (where s.status = 'completed') as last_sold_at
from public.products p
left join public.categories c on c.id = p.category_id
left join public.sale_items si on si.product_id = p.id
left join public.sales s on s.id = si.sale_id
group by p.id, c.name;

-- ---------------------------------------------------------------------
-- v_customer_analytics : comportement d'achat vie entière par client
-- ---------------------------------------------------------------------
create or replace view public.v_customer_analytics
with (security_invoker = true) as
select
  c.id as customer_id,
  c.name as customer_name,
  c.phone,
  c.is_active,
  count(s.id) filter (where s.status = 'completed') as orders_count,
  coalesce(sum(s.total_amount) filter (where s.status = 'completed'), 0) as total_spent,
  case
    when count(s.id) filter (where s.status = 'completed') > 0
    then round(
      coalesce(sum(s.total_amount) filter (where s.status = 'completed'), 0)
        / count(s.id) filter (where s.status = 'completed'),
      2
    )
    else 0
  end as avg_basket,
  max(s.sale_date) filter (where s.status = 'completed') as last_purchase_date
from public.customers c
left join public.sales s on s.customer_id = c.id
group by c.id;
