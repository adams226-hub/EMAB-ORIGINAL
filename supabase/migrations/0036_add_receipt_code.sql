-- =====================================================================
-- EMAB ERP — Code de discrétion sur le reçu client (demande explicite :
-- les produits vétérinaires ne doivent pas apparaître sous leur vrai nom
-- sur le reçu imprimé, seulement sous un code).
--
-- receipt_code est générique (pas réservé aux produits vétérinaires) :
-- si renseigné, le reçu l'affiche à la place du nom réel ; sinon le nom
-- réel est affiché comme avant. Partout ailleurs dans l'app (POS, détail
-- de vente, rapports, stock), le nom réel reste utilisé sans changement.
-- =====================================================================

alter table public.products
  add column receipt_code text;

comment on column public.products.receipt_code is
  'Code affiché sur le reçu client à la place du nom réel (discrétion). NULL = le nom réel est affiché.';

-- Backfill : VET-001, VET-002... pour les produits déjà classés dans la
-- catégorie "Produits vétérinaires", par ordre alphabétique de nom.
with vet as (
  select p.id, row_number() over (order by p.name) as rn
  from public.products p
  join public.categories c on c.id = p.category_id
  where c.slug = 'produits-veterinaires'
)
update public.products p
set receipt_code = 'VET-' || lpad(vet.rn::text, 3, '0')
from vet
where p.id = vet.id;
