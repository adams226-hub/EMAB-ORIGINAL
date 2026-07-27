-- =====================================================================
-- EMAB ERP — Phase 4 — Supabase Realtime
-- Ajoute expenses au flux temps réel (sales/payments déjà ajoutés en
-- Phase 3) pour que le dashboard analytique se rafraîchisse en direct.
-- =====================================================================

alter publication supabase_realtime add table public.expenses;
