-- =====================================================================
-- EMAB ERP — Phase 3 — Supabase Realtime
-- =====================================================================

alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.cash_sessions;
