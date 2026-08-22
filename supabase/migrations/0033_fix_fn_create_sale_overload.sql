-- =====================================================================
-- EMAB ERP — Corrige l'ambiguïté de surcharge sur fn_create_sale
-- 0032 a ajouté une nouvelle version à 9 paramètres (p_walkin_name,
-- p_walkin_phone) via CREATE OR REPLACE, mais Postgres identifie une
-- fonction par ses types de paramètres : une signature à 7 arguments
-- est distincte d'une signature à 9, donc l'ancienne version (Phase 5,
-- 0022) est restée en place à côté de la nouvelle. PostgREST ne peut
-- alors plus décider laquelle appeler ("Could not choose the best
-- candidate function"). On supprime l'ancienne signature à 7 arguments :
-- seule la version à 9 (avec p_walkin_name/p_walkin_phone par défaut
-- null) reste, compatible avec tous les appels existants.
-- =====================================================================

drop function if exists public.fn_create_sale(uuid, uuid, numeric, uuid, numeric, text, jsonb);
