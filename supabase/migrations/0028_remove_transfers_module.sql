-- =====================================================================
-- EMAB ERP — Suppression du module Transferts (transferts inter-magasins)
-- =====================================================================

drop function if exists public.fn_validate_transfer(uuid);
drop function if exists public.fn_receive_transfer(uuid);
drop function if exists public.fn_cancel_transfer(uuid);

drop table if exists public.stock_transfer_items cascade;
drop table if exists public.stock_transfers cascade;

drop sequence if exists public.transfer_seq;
