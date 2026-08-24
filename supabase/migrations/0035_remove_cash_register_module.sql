-- =====================================================================
-- EMAB ERP — Suppression totale du module Caisse (demande explicite :
-- retrait complet, code + DB). Suit le même schéma que la suppression
-- des modules Fournisseurs (0026) et Transferts (0028).
--
-- cash_adjustments référence cash_sessions par FK : on la supprime en
-- premier. Les fonctions SECURITY DEFINER qui retournent public.cash_sessions
-- doivent être supprimées avant la table (dépendance de type retour).
-- =====================================================================

drop function if exists public.fn_close_cash_session(uuid, numeric, text);
drop function if exists public.fn_open_cash_session(uuid, numeric);

drop table if exists public.cash_adjustments cascade;
drop table if exists public.cash_sessions cascade;

drop type if exists public.cash_adjustment_type;
drop type if exists public.cash_session_status;
