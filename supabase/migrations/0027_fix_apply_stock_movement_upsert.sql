-- =====================================================================
-- EMAB ERP — Correctif : apply_stock_movement() empêchait toute vente
-- (ou sortie de stock) sur un produit déjà présent dans product_stock.
--
-- Cause : `insert into product_stock (...) values (..., delta) on conflict
-- (product_id, store_id) do update set quantity = quantity + excluded.quantity`
-- — PostgreSQL valide la contrainte CHECK (quantity >= 0) sur la valeur
-- BRUTE proposée pour l'INSERT (ici `delta`, négatif pour une sortie)
-- AVANT de déterminer qu'il s'agit d'un conflit à fusionner. Résultat :
-- une sortie de 1 unité sur un stock de 20 échouait avec « quantity -1
-- viole la contrainte », alors que le résultat final (19) est valide.
--
-- Correctif : UPDATE direct (le CHECK y est bien validé sur la valeur
-- finale fusionnée, comportement standard d'un UPDATE) et INSERT
-- seulement si aucune ligne n'existait encore pour ce produit/magasin.
-- =====================================================================

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

  update public.product_stock
  set quantity = quantity + delta, updated_at = now()
  where product_id = new.product_id and store_id = new.store_id;

  if not found then
    insert into public.product_stock (product_id, store_id, quantity)
    values (new.product_id, new.store_id, delta);
  end if;

  return new;
end;
$$;
