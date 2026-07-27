-- =====================================================================
-- EMAB ERP — Phase 3 — Données de référence
-- =====================================================================

insert into public.payment_methods (name, is_cash) values
  ('Espèces', true),
  ('Mobile Money', false),
  ('Carte bancaire', false),
  ('Virement bancaire', false),
  ('Chèque', false)
on conflict (name) do nothing;

insert into public.expense_categories (name) values
  ('Carburant'),
  ('Transport'),
  ('Loyer'),
  ('Salaires'),
  ('Achats divers'),
  ('Entretien & réparations'),
  ('Autre')
on conflict (name) do nothing;
