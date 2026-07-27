-- =====================================================================
-- EMAB ERP — Phase 1 — Données de démonstration
-- À exécuter uniquement en environnement de développement.
-- Le premier compte super_admin doit être créé manuellement dans
-- Supabase Auth (Dashboard > Authentication > Add user), puis :
--   update public.profiles set role = 'super_admin', store_id = null
--   where email = 'admin@votre-domaine.com';
-- =====================================================================

insert into public.categories (name, slug, description) values
  ('Alimentation',        'alimentation',        'Produits alimentaires et boissons'),
  ('Hygiène & Beauté',    'hygiene-beaute',       'Cosmétiques et soins'),
  ('Électronique',        'electronique',         'Accessoires et petits appareils'),
  ('Vêtements',           'vetements',            'Textile et accessoires'),
  ('Maison & Décoration', 'maison-decoration',    'Articles pour la maison')
on conflict (slug) do nothing;

insert into public.stores (name, code, address, city, phone) values
  ('EMAB Centre-Ville', 'ST-001', '12 Avenue Centrale', 'Douala', '+237600000001'),
  ('EMAB Akwa',         'ST-002', '45 Rue du Marché',   'Douala', '+237600000002'),
  ('EMAB Bonanjo',      'ST-003', '3 Boulevard du Port', 'Douala', '+237600000003')
on conflict (code) do nothing;
