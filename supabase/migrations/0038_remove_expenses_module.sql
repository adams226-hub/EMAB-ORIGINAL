-- =====================================================================
-- EMAB ERP — Suppression totale du module Dépenses (demande explicite :
-- retrait complet, code + DB). Aucune autre table ne référence expenses
-- ou expense_categories par clé étrangère.
-- =====================================================================

drop table if exists public.expenses cascade;
drop table if exists public.expense_categories cascade;
