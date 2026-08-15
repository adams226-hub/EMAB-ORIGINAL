-- =====================================================================
-- EMAB ERP — Import du catalogue produits (aliments volaille, produits
-- vétérinaires, équipements d'élevage) depuis la liste de prix fournie.
-- Le prix "Distributeur" du tableau source correspond au wholesale_price.
-- Idempotent : peut être rejoué sans dupliquer (ON CONFLICT tenant_id+sku).
-- tenant_id fixé explicitement (00000000-...-001, seul tenant existant) :
-- exécuté hors contexte auth, le trigger set_tenant_id() ne peut pas le
-- déduire de auth.uid().
-- =====================================================================

-- ---------------------------------------------------------------------
-- Catégories
-- ---------------------------------------------------------------------
insert into public.categories (tenant_id, name, slug)
values
  ('00000000-0000-0000-0000-000000000001', 'Aliments volaille', 'aliments-volaille'),
  ('00000000-0000-0000-0000-000000000001', 'Produits vétérinaires', 'produits-veterinaires'),
  ('00000000-0000-0000-0000-000000000001', 'Équipements d''élevage', 'equipements-elevage')
on conflict (tenant_id, slug) do nothing;

-- ---------------------------------------------------------------------
-- Produits — Aliments volaille (avec prix de gros "distributeur")
-- ---------------------------------------------------------------------
with cat as (select id from public.categories where slug = 'aliments-volaille')
insert into public.products (tenant_id, name, sku, category_id, unit, purchase_price, sale_price, wholesale_price)
select '00000000-0000-0000-0000-000000000001', v.name, v.sku, cat.id, v.unit, v.purchase_price, v.sale_price, v.wholesale_price::numeric
from cat, (values
  ('A1', 'A1', 'sac', 16875, 18000, 17250),
  ('A2', 'A2', 'sac', 16375, 17500, 16750),
  ('A3', 'A3', 'sac', 16375, 17500, 16750),
  ('A4', 'A4', 'sac', 16375, 17500, 16750),
  ('A5', 'A5', 'sac', 16375, 17500, 16750),
  ('Coq', 'COQ', 'sac', 16375, 17500, 16750),
  ('CH1', 'CH1', 'sac', 18375, 19500, 18750),
  ('CH2', 'CH2', 'sac', 17875, 19000, 18250),
  ('C', 'C', 'sac', 27500, 29500, 28500),
  ('G', 'G', 'sac', 18500, 20000, 19000),
  ('PRD', 'PRD', 'sac', 14125, 16500, 15000),
  ('CH1G', 'CH1G', 'sac', 19375, 20500, 19750),
  ('CH2G', 'CH2G', 'sac', 18875, 20000, 19250),
  ('A1G', 'A1G', 'sac', 17875, 19000, 18250),
  ('CoqG', 'COQG', 'sac', 17375, 19000, 18250),
  ('P2A', 'P2A', 'sac', 15375, 16250, 15625),
  ('PC', 'PC', 'sac', 14375, 15250, 14625),
  ('PF', 'PF', 'sac', 13875, 14750, 14125),
  ('TA', 'TA', 'sac', 15125, 16000, 15375),
  ('TG', 'TG', 'sac', 13875, 14750, 14125),
  ('CT Porcelet', 'CT-PORCELET', 'sac', 31500, 33500, 32500),
  ('CP Charcuterie', 'CP-CHARCUTERIE', 'sac', 27000, 29000, 28000),
  ('TS', 'TS', 'sac', 18625, 20000, 19000),
  ('P 350', 'P-350', 'sac', 27500, 29500, 28500),
  ('Embouche', 'EMBOUCHE', 'sac', 11500, 12500, 12000),
  ('Vache laitière', 'VACHE-LAITIERE', 'sac', 12250, 13250, 12750),
  ('Galdus', 'GALDUS-KG', 'kg', 0, 1000, null),
  ('Galdus (demi-sac)', 'GALDUS-DEMI-SAC', 'demi-sac', 0, 8500, null),
  ('Poussin (aliment)', 'POUSSIN-KG', 'kg', 0, 400, null),
  ('Poussin (aliment, demi-sac)', 'POUSSIN-DEMI-SAC', 'demi-sac', 0, 9250, null),
  ('Poulette (aliment)', 'POULETTE-KG', 'kg', 0, 400, null),
  ('Poulette (aliment, demi-sac)', 'POULETTE-DEMI-SAC', 'demi-sac', 0, 9000, null),
  ('Son de blé', 'SON-BLE', 'sac', 0, 4000, null),
  ('Huile de soja 5L', 'HUILE-SOJA-5L', 'litre', 0, 6500, null),
  ('Huile de soja 3L', 'HUILE-SOJA-3L', 'litre', 0, 4000, null),
  ('Huile de soja 1L', 'HUILE-SOJA-1L', 'litre', 0, 1600, null),
  ('Huile de soja 20L', 'HUILE-SOJA-20L', 'litre', 0, 24000, null),
  ('Embouche (au kg)', 'EMBOUCHE-KG', 'kg', 0, 350, null),
  ('AVL', 'AVL-KG', 'kg', 0, 350, null)
) as v(name, sku, unit, purchase_price, sale_price, wholesale_price)
on conflict (tenant_id, sku) do nothing;

-- ---------------------------------------------------------------------
-- Produits — Produits vétérinaires
-- ---------------------------------------------------------------------
with cat as (select id from public.categories where slug = 'produits-veterinaires')
insert into public.products (tenant_id, name, sku, category_id, unit, purchase_price, sale_price, wholesale_price)
select '00000000-0000-0000-0000-000000000001', v.name, v.sku, cat.id, v.unit, v.purchase_price, v.sale_price, v.wholesale_price::numeric
from cat, (values
  ('Amin Total', 'AMIN-TOTAL', 'pièce', 3000, 3500, null),
  ('Vitaboost', 'VITABOOST', 'pièce', 2500, 3000, null),
  ('Vitamix Super', 'VITAMIX-SUPER', 'pièce', 2500, 3000, null),
  ('Vitamix Super 1Kg', 'VITAMIX-SUPER-1KG', 'kg', 15000, 18000, null),
  ('Introvit WS', 'INTROVIT-WS', 'pièce', 2000, 2500, null),
  ('Megavit', 'MEGAVIT', 'pièce', 350, 500, null),
  ('Alyseril', 'ALYSERIL', 'pièce', 2500, 3000, null),
  ('Alfaceril', 'ALFACERIL', 'pièce', 2500, 3000, null),
  ('Geniceril', 'GENICERIL', 'pièce', 2500, 3000, null),
  ('Geniceril 5g', 'GENICERIL-5G', 'pièce', 300, 500, null),
  ('Tetracolivit', 'TETRACOLIVIT', 'pièce', 2500, 3000, null),
  ('Tetracolivit 1Kg', 'TETRACOLIVIT-1KG', 'kg', 22000, 25000, null),
  ('Tetra comprimé', 'TETRA-COMPRIME', 'pièce', 50, 100, null),
  ('Oxy 50%', 'OXY-50', 'pièce', 3500, 4000, null),
  ('Oxy 50% 1Kg', 'OXY-50-1KG', 'kg', 33000, 35000, null),
  ('Tyl Dox', 'TYL-DOX', 'pièce', 4750, 5000, null),
  ('Oxy Veto', 'OXY-VETO', 'pièce', 3500, 4000, null),
  ('Ashoxy', 'ASHOXY', 'pièce', 2000, 2500, null),
  ('Ashoxy 5g', 'ASHOXY-5G', 'pièce', 300, 400, null),
  ('Diasiprim', 'DIASIPRIM', 'pièce', 5500, 6500, null),
  ('Trisulmicile Fort', 'TRISULMICILE-FORT', 'pièce', 7500, 8500, null),
  ('Virunet', 'VIRUNET', 'pièce', 1500, 1750, null),
  ('Virunet 1Kg', 'VIRUNET-1KG', 'kg', 18500, 20000, null),
  ('Virunil', 'VIRUNIL', 'pièce', 2000, 2500, null),
  ('Hepatyril', 'HEPATYRIL', 'pièce', 1750, 2000, null),
  ('Amprolum', 'AMPROLUM', 'pièce', 3000, 3500, null),
  ('Anticox', 'ANTICOX', 'pièce', 4500, 5000, null),
  ('Anticox 1Kg', 'ANTICOX-1KG', 'kg', 40000, 45000, null),
  ('Leva 200', 'LEVA-200', 'pièce', 3500, 4000, null),
  ('Levalap', 'LEVALAP', 'pièce', 3500, 4000, null),
  ('Levamisole', 'LEVAMISOLE', 'pièce', 3500, 4000, null),
  ('Vigonine', 'VIGONINE', 'pièce', 12500, 15000, null),
  ('Procalsum', 'PROCALSUM', 'pièce', 4500, 5000, null),
  ('Panteryl', 'PANTERYL', 'pièce', 0, 3500, null),
  ('Areva', 'AREVA', 'pièce', 0, 2500, null)
) as v(name, sku, unit, purchase_price, sale_price, wholesale_price)
on conflict (tenant_id, sku) do nothing;

-- ---------------------------------------------------------------------
-- Produits — Équipements d'élevage
-- ---------------------------------------------------------------------
with cat as (select id from public.categories where slug = 'equipements-elevage')
insert into public.products (tenant_id, name, sku, category_id, unit, purchase_price, sale_price, wholesale_price)
select '00000000-0000-0000-0000-000000000001', v.name, v.sku, cat.id, v.unit, v.purchase_price, v.sale_price, v.wholesale_price::numeric
from cat, (values
  ('Abreuvoir 11L (pied)', 'ABREVOIR-11L-PIED', 'pièce', 3500, 4000, null),
  ('Abreuvoir 11L', 'ABREVOIR-11L', 'pièce', 2500, 3000, null),
  ('Abreuvoir 6L (pied)', 'ABREVOIR-6L-PIED', 'pièce', 2500, 3000, null),
  ('Abreuvoir 6L', 'ABREVOIR-6L', 'pièce', 1750, 2000, null),
  ('Abreuvoir 3L (pied)', 'ABREVOIR-3L-PIED', 'pièce', 1500, 2000, null),
  ('Abreuvoir 3L', 'ABREVOIR-3L', 'pièce', 1100, 1500, null),
  ('Abreuvoir 1,5L', 'ABREVOIR-1-5L', 'pièce', 600, 1000, null),
  ('Abreuvoir 1,5L (pied)', 'ABREVOIR-1-5L-PIED', 'pièce', 0, 1250, null),
  ('Mangeoire 10Kg (pied)', 'MANGEOIRE-10KG-PIED', 'pièce', 3500, 4000, null),
  ('Mangeoire 10Kg', 'MANGEOIRE-10KG', 'pièce', 2500, 3000, null),
  ('Mangeoire 6Kg (pied)', 'MANGEOIRE-6KG-PIED', 'pièce', 2500, 3000, null),
  ('Mangeoire 6Kg', 'MANGEOIRE-6KG', 'pièce', 1750, 2000, null),
  ('Mangeoire 3Kg (pied)', 'MANGEOIRE-3KG-PIED', 'pièce', 1500, 2000, null),
  ('Mangeoire 3Kg', 'MANGEOIRE-3KG', 'pièce', 1100, 1500, null),
  ('Mangeoire 1,5Kg', 'MANGEOIRE-1-5KG', 'pièce', 600, 1000, null),
  ('Plateau grand', 'PLATEAU-GRAND', 'pièce', 1500, 2000, null),
  ('Plateau moyen', 'PLATEAU-MOYEN', 'pièce', 1250, 1500, null),
  ('Plateau petit', 'PLATEAU-PETIT', 'pièce', 850, 1250, null),
  ('Caisse poulet', 'CAISSE-POULET', 'pièce', 20000, 22000, null),
  ('Panier poussin', 'PANIER-POUSSIN', 'pièce', 2000, 2500, null),
  ('Alvéole', 'ALVEOL', 'pièce', 0, 5000, null),
  ('Chaussure', 'CHAUSURE', 'pièce', 0, 2000, null),
  ('Fourneau petit', 'FOURNEAU-PETIT', 'pièce', 0, 3000, null),
  ('Fourneau grand', 'FOURNEAU-GRAND', 'pièce', 0, 6000, null),
  ('Fourneau moyen', 'FOURNEAU-MOYEN', 'pièce', 0, 5000, null)
) as v(name, sku, unit, purchase_price, sale_price, wholesale_price)
on conflict (tenant_id, sku) do nothing;

-- ---------------------------------------------------------------------
-- Œufs (catégorie Aliments volaille, produit fini vendu au magasin)
-- ---------------------------------------------------------------------
with cat as (select id from public.categories where slug = 'aliments-volaille')
insert into public.products (tenant_id, name, sku, category_id, unit, purchase_price, sale_price, wholesale_price)
select '00000000-0000-0000-0000-000000000001', 'Œufs', 'OEUFS', cat.id, 'pièce', 0, 3000, null
from cat
on conflict (tenant_id, sku) do nothing;
