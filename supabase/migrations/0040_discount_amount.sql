-- =====================================================================
-- EMAB ERP — Remplace la remise en pourcentage par un montant fixe
-- (FCFA), au niveau de la vente (discount_amount global) et de chaque
-- ligne de vente (discount_amount par ligne). Le montant est plus lisible
-- pour la caisse qu'un taux, et évite les arrondis.
--
-- Backfill : pour les ventes déjà enregistrées, discount_amount se
-- déduit exactement de l'historique (subtotal - total_amount pour la
-- vente, quantity*unit_price - line_total pour chaque ligne), donc
-- aucune perte d'information sur les ventes passées.
--
-- Ordre important : v_sales_detail dépend de sales.discount_percent et
-- v_product_performance dépend de sale_items.line_total (généré à partir
-- de discount_percent) — ces vues doivent être recréées/supprimées avant
-- de toucher les colonnes dont elles dépendent, sinon Postgres refuse le
-- drop (erreur 2BP01).
-- =====================================================================

-- ---------------------------------------------------------------------
-- sales.discount_percent -> sales.discount_amount
-- ---------------------------------------------------------------------
alter table public.sales add column discount_amount numeric(12,2) not null default 0;

update public.sales set discount_amount = greatest(round(subtotal - total_amount, 2), 0);

-- La vue renomme une colonne en place (discount_percent -> discount_amount),
-- ce que CREATE OR REPLACE VIEW interdit (les noms de colonnes existants ne
-- peuvent pas changer) : on la supprime et la recrée entièrement.
drop view public.v_sales_detail;

alter table public.sales drop column discount_percent;

alter table public.sales
  add constraint sales_discount_amount_check check (discount_amount >= 0 and discount_amount <= subtotal);

create view public.v_sales_detail
with (security_invoker = true) as
select
  s.id,
  s.reference,
  s.store_id,
  st.name as store_name,
  s.customer_id,
  coalesce(c.name, s.walkin_name) as customer_name,
  s.sold_by,
  pr.full_name as sold_by_name,
  s.sale_date,
  s.subtotal,
  s.discount_amount,
  s.total_amount,
  s.amount_paid,
  s.amount_due,
  case
    when s.status = 'cancelled' then 'cancelled'
    when s.amount_due <= 0 then 'paid'
    when s.amount_paid = 0 then 'unpaid'
    else 'partial'
  end as payment_status,
  s.status,
  s.notes,
  s.created_at,
  coalesce(c.phone, s.walkin_phone) as customer_phone
from public.sales s
join public.stores st on st.id = s.store_id
left join public.customers c on c.id = s.customer_id
left join public.profiles pr on pr.id = s.sold_by;

-- ---------------------------------------------------------------------
-- sale_items.discount_percent -> sale_items.discount_amount
-- line_total est une colonne générée qui dépend de discount_percent, et
-- v_product_performance dépend de line_total : on doit supprimer cette
-- vue avant de toucher aux colonnes, puis la recréer à l'identique.
-- ---------------------------------------------------------------------
alter table public.sale_items add column discount_amount numeric(12,2) not null default 0;

update public.sale_items
  set discount_amount = greatest(round(quantity * unit_price - line_total, 2), 0);

drop view public.v_product_performance;

alter table public.sale_items drop column line_total;
alter table public.sale_items drop column discount_percent;

alter table public.sale_items add column line_total numeric(12,2) generated always as (
  round(quantity * unit_price - discount_amount, 2)
) stored;

alter table public.sale_items
  add constraint sale_items_discount_amount_check
    check (discount_amount >= 0 and discount_amount <= quantity * unit_price);

-- Recrée v_product_performance à l'identique (même colonne line_total, nouvelle formule sous-jacente).
create or replace view public.v_product_performance
with (security_invoker = true) as
select
  p.id as product_id,
  p.name as product_name,
  p.sku,
  p.category_id,
  c.name as category_name,
  p.is_active,
  coalesce(sum(si.quantity) filter (where s.status = 'completed'), 0) as total_quantity_sold,
  coalesce(sum(si.line_total) filter (where s.status = 'completed'), 0) as total_revenue,
  coalesce(sum(si.quantity * si.unit_cost) filter (where s.status = 'completed'), 0) as total_cost,
  coalesce(sum(si.line_total) filter (where s.status = 'completed'), 0)
    - coalesce(sum(si.quantity * si.unit_cost) filter (where s.status = 'completed'), 0) as margin,
  max(s.sale_date) filter (where s.status = 'completed') as last_sold_at
from public.products p
left join public.categories c on c.id = p.category_id
left join public.sale_items si on si.product_id = p.id
left join public.sales s on s.id = si.sale_id
group by p.id, c.name;

-- ---------------------------------------------------------------------
-- Garde-fou financier (0011) : référence discount_percent -> discount_amount
-- ---------------------------------------------------------------------
create or replace function public.guard_financial_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('emab.trusted_write', true) is distinct from 'on' then
    if new.amount_paid is distinct from old.amount_paid then
      raise exception 'amount_paid ne peut être modifié que via un paiement enregistré';
    end if;

    if TG_TABLE_NAME = 'purchase_orders' and new.total_amount is distinct from old.total_amount then
      raise exception 'total_amount est figé à la création de la commande';
    end if;

    if TG_TABLE_NAME = 'sales' and (
      new.subtotal is distinct from old.subtotal
      or new.total_amount is distinct from old.total_amount
      or new.discount_amount is distinct from old.discount_amount
    ) then
      raise exception 'Les montants d''une vente sont figés à la création';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_create_sale (version en vigueur depuis 0037, 9 arguments) : reprise
-- à l'identique, discount en montant (FCFA) plutôt qu'en pourcentage.
-- p_items : [{ "product_id": uuid, "quantity": n, "unit_price": n, "discount_amount": n, "sale_type": "retail"|"wholesale" }]
--
-- CREATE OR REPLACE interdit de renommer un paramètre existant
-- (p_discount_percent -> p_discount_amount) : on supprime d'abord la
-- signature actuelle, puis on la recrée avec le nouveau nom, et on
-- réattribue le droit d'exécution perdu par le drop.
-- ---------------------------------------------------------------------
drop function public.fn_create_sale(uuid, uuid, numeric, uuid, numeric, text, jsonb, text, text);

create function public.fn_create_sale(
  p_store_id uuid,
  p_customer_id uuid,
  p_discount_amount numeric,
  p_payment_method_id uuid,
  p_amount_paid numeric,
  p_notes text,
  p_items jsonb,
  p_walkin_name text default null,
  p_walkin_phone text default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_item jsonb;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_line_total numeric(12,2);
  v_line_discount numeric(12,2);
  v_unit_cost numeric(12,2);
  v_product_id uuid;
begin
  if not public.store_in_my_tenant(p_store_id) then
    raise exception 'Magasin introuvable';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and tenant_id = public.my_tenant_id()
  ) then
    raise exception 'Client introuvable';
  end if;

  if public.my_role() not in ('super_admin', 'manager', 'cashier') then
    raise exception 'Non autorisé à enregistrer une vente';
  end if;

  if not (public.is_super_admin() or public.my_store_id() = p_store_id) then
    raise exception 'Vous ne pouvez vendre que pour votre propre magasin';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;

    if not exists (select 1 from public.products where id = v_product_id and tenant_id = public.my_tenant_id()) then
      raise exception 'Produit introuvable';
    end if;

    v_line_discount := coalesce((v_item->>'discount_amount')::numeric, 0);
    if v_line_discount > (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric then
      raise exception 'La remise d''une ligne ne peut pas dépasser son montant';
    end if;

    v_line_total := round(
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric - v_line_discount,
      2
    );
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if coalesce(p_discount_amount, 0) > v_subtotal then
    raise exception 'La remise globale ne peut pas dépasser le sous-total de la vente';
  end if;

  v_total := round(v_subtotal - coalesce(p_discount_amount, 0), 2);

  if p_amount_paid > v_total then
    raise exception 'Le montant payé ne peut pas dépasser le total de la vente';
  end if;

  insert into public.sales (
    store_id, customer_id, sold_by, subtotal, discount_amount, total_amount, notes, walkin_name, walkin_phone
  )
  values (
    p_store_id, p_customer_id, auth.uid(), v_subtotal, coalesce(p_discount_amount, 0), v_total, p_notes,
    nullif(trim(p_walkin_name), ''), nullif(trim(p_walkin_phone), '')
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select purchase_price into v_unit_cost from public.products where id = (v_item->>'product_id')::uuid;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost, discount_amount, sale_type)
    values (
      v_sale.id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      coalesce(v_unit_cost, 0),
      coalesce((v_item->>'discount_amount')::numeric, 0),
      coalesce(v_item->>'sale_type', 'retail')
    );

    insert into public.stock_movements (type, product_id, store_id, quantity, reference_type, reference_id, created_by)
    values ('out', (v_item->>'product_id')::uuid, p_store_id, (v_item->>'quantity')::numeric, 'sale', v_sale.id, auth.uid());
  end loop;

  if p_amount_paid > 0 then
    insert into public.payments (type, reference_id, amount, payment_method_id, store_id, paid_by)
    values ('sale_payment', v_sale.id, p_amount_paid, p_payment_method_id, p_store_id, auth.uid());
  end if;

  select * into v_sale from public.sales where id = v_sale.id;
  return v_sale;
end;
$$;

grant execute on function public.fn_create_sale(uuid, uuid, numeric, uuid, numeric, text, jsonb, text, text) to authenticated;
