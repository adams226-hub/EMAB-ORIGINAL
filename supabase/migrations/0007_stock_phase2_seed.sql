-- =====================================================================
-- EMAB ERP — Phase 2 — Données de démonstration
-- =====================================================================

insert into public.units (name, abbreviation) values
  ('Pièce', 'pc'),
  ('Kilogramme', 'kg'),
  ('Litre', 'L'),
  ('Carton', 'ctn'),
  ('Sachet', 'sach')
on conflict (name) do nothing;

insert into public.suppliers (name, contact_name, phone, email) values
  ('Grossiste Central SARL', 'M. Fotso', '+237677000001', 'contact@grossiste-central.cm'),
  ('Import Distribution CM', 'Mme Ngo', '+237677000002', 'contact@import-distrib.cm')
on conflict do nothing;
