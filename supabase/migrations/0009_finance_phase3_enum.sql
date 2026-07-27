-- =====================================================================
-- EMAB ERP — Phase 3 — Extension d'enum
-- ALTER TYPE ... ADD VALUE doit être commité seul, avant toute
-- utilisation de la nouvelle valeur dans une autre migration.
-- =====================================================================

alter type public.movement_reference_type add value 'sale';
