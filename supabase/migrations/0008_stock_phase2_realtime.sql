-- =====================================================================
-- EMAB ERP — Phase 2 — Supabase Realtime
-- Permet aux clients abonnés (dashboard stock) de recevoir les
-- changements en direct. Les policies RLS déjà en place restent
-- appliquées : un client ne reçoit que les événements des lignes
-- qu'il est autorisé à SELECT.
-- =====================================================================

alter publication supabase_realtime add table public.product_stock;
alter publication supabase_realtime add table public.stock_movements;
alter publication supabase_realtime add table public.stock_transfers;
