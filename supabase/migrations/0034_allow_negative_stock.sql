-- =====================================================================
-- EMAB ERP — Autorise le stock négatif (demande explicite : une vente
-- ou une sortie de stock doit pouvoir être enregistrée même si le stock
-- disponible est insuffisant ou déjà à zéro).
--
-- La contrainte CHECK (quantity >= 0) sur product_stock est celle qui
-- bloquait jusqu'ici toute sortie (vente, mouvement manuel, ajustement)
-- ramenant le stock sous zéro. On la retire : le stock peut désormais
-- devenir négatif, ce qui reste visible et alerté via alert_threshold.
-- =====================================================================

alter table public.product_stock
  drop constraint if exists product_stock_quantity_check;
