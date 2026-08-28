-- =====================================================================
-- EMAB ERP — Ajoute un champ Référence saisissable sur les mouvements de
-- stock manuels (entrée / sortie / ajustement) — ex. numéro de bon de
-- livraison ou de facture, distinct du motif (reason, qui reste une
-- liste fermée) et des notes libres.
-- =====================================================================

alter table public.stock_movements
  add column reference text;

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
  m.reason,
  m.notes,
  m.reversal_of,
  m.created_by,
  pr.full_name as created_by_name,
  m.created_at,
  m.reference
from public.stock_movements m
join public.products p on p.id = m.product_id
join public.stores s on s.id = m.store_id
left join public.profiles pr on pr.id = m.created_by;
