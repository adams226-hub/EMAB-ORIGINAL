-- =====================================================================
-- EMAB ERP — Phase 3 — Ventes, caisse, finances
-- Schéma : enums, tables, colonnes générées, index
-- =====================================================================

create type public.sale_status as enum ('completed', 'cancelled');
create type public.payment_type as enum ('sale_payment', 'purchase_payment');
create type public.cash_session_status as enum ('open', 'closed');
create type public.cash_adjustment_type as enum ('in', 'out');

-- ---------------------------------------------------------------------
-- Table : payment_methods (modes de paiement)
-- is_cash identifie le mode qui alimente la caisse physique (réconciliation).
-- ---------------------------------------------------------------------
create table public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_cash     boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Table : customers (clients — référentiel global, achats multi-magasins)
-- ---------------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  email         text,
  address       text,
  credit_limit  numeric(12,2) not null default 0 check (credit_limit >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Table : expense_categories
-- ---------------------------------------------------------------------
create table public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Table : expenses (dépenses — payées immédiatement, pas de crédit)
-- ---------------------------------------------------------------------
create table public.expenses (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references public.stores(id),
  category_id         uuid references public.expense_categories(id),
  payment_method_id   uuid not null references public.payment_methods(id),
  amount              numeric(12,2) not null check (amount > 0),
  description         text not null,
  expense_date        date not null default current_date,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

create index idx_expenses_store_date on public.expenses(store_id, expense_date desc);

-- ---------------------------------------------------------------------
-- Table : sales (ventes — en-tête, quasi immuable après création)
-- Les montants ne sont modifiables que par les fonctions SECURITY DEFINER
-- (fn_create_sale, fn_cancel_sale, trigger apply_payment) — voir 0011 et
-- le trigger de garde public.guard_financial_columns().
-- ---------------------------------------------------------------------
create table public.sales (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  store_id          uuid not null references public.stores(id),
  customer_id       uuid references public.customers(id),
  sold_by           uuid references public.profiles(id),
  sale_date         timestamptz not null default now(),
  subtotal          numeric(12,2) not null check (subtotal >= 0),
  discount_percent  numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  total_amount      numeric(12,2) not null check (total_amount >= 0),
  amount_paid       numeric(12,2) not null default 0 check (amount_paid >= 0 and amount_paid <= total_amount),
  status            public.sale_status not null default 'completed',
  notes             text,
  created_at        timestamptz not null default now(),

  amount_due numeric(12,2) generated always as (total_amount - amount_paid) stored
);

create index idx_sales_store_date on public.sales(store_id, sale_date desc);
create index idx_sales_customer on public.sales(customer_id);

-- ---------------------------------------------------------------------
-- Table : sale_items (lignes de vente)
-- unit_cost capture le prix d'achat au moment de la vente → marge exacte
-- même si le prix d'achat du produit change plus tard.
-- ---------------------------------------------------------------------
create table public.sale_items (
  id                uuid primary key default gen_random_uuid(),
  sale_id           uuid not null references public.sales(id) on delete cascade,
  product_id        uuid not null references public.products(id),
  quantity          numeric(12,2) not null check (quantity > 0),
  unit_price        numeric(12,2) not null check (unit_price >= 0),
  unit_cost         numeric(12,2) not null default 0,
  discount_percent  numeric(5,2) not null default 0 check (discount_percent between 0 and 100),

  line_total numeric(12,2) generated always as (
    round(quantity * unit_price * (1 - discount_percent / 100.0), 2)
  ) stored
);

create index idx_sale_items_sale on public.sale_items(sale_id);
create index idx_sale_items_product on public.sale_items(product_id);

-- ---------------------------------------------------------------------
-- Table : payments — grand livre des paiements (créances & dettes)
-- Append-only, comme stock_movements. Alimente sales.amount_paid et
-- purchase_orders.amount_paid via le trigger apply_payment (0011).
-- ---------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  type                public.payment_type not null,
  reference_id        uuid not null,
  amount              numeric(12,2) not null check (amount > 0),
  payment_method_id   uuid not null references public.payment_methods(id),
  store_id            uuid not null references public.stores(id),
  paid_by             uuid references public.profiles(id),
  payment_date        timestamptz not null default now(),
  notes               text,
  created_at          timestamptz not null default now()
);

create index idx_payments_reference on public.payments(type, reference_id);
create index idx_payments_store_date on public.payments(store_id, payment_date desc);

-- ---------------------------------------------------------------------
-- Extension purchase_orders (Phase 2) : suivi des paiements fournisseur
-- ---------------------------------------------------------------------
alter table public.purchase_orders
  add column total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  add column amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0 and amount_paid <= total_amount);

-- Rétro-calcul du total pour les commandes déjà existantes (Phase 2 seed éventuel)
update public.purchase_orders po
set total_amount = coalesce((
  select sum(quantity_ordered * unit_price) from public.purchase_order_items where purchase_order_id = po.id
), 0);

alter table public.purchase_orders
  add column amount_due numeric(12,2) generated always as (total_amount - amount_paid) stored;

-- ---------------------------------------------------------------------
-- Table : cash_sessions (une caisse ouverte à la fois par magasin)
-- ---------------------------------------------------------------------
create table public.cash_sessions (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores(id),
  status            public.cash_session_status not null default 'open',
  opened_by         uuid references public.profiles(id),
  opened_at         timestamptz not null default now(),
  opening_amount    numeric(12,2) not null default 0 check (opening_amount >= 0),
  closed_by         uuid references public.profiles(id),
  closed_at         timestamptz,
  closing_amount    numeric(12,2),
  expected_amount   numeric(12,2),
  notes             text,

  difference numeric(12,2) generated always as (closing_amount - expected_amount) stored
);

-- Une seule session ouverte par magasin à la fois
create unique index idx_one_open_session_per_store
  on public.cash_sessions(store_id)
  where (status = 'open');

create index idx_cash_sessions_store on public.cash_sessions(store_id, opened_at desc);

-- ---------------------------------------------------------------------
-- Table : cash_adjustments (mouvements de caisse hors ventes/dépenses —
-- dépôt de monnaie, retrait pour la banque, etc.)
-- ---------------------------------------------------------------------
create table public.cash_adjustments (
  id                uuid primary key default gen_random_uuid(),
  cash_session_id   uuid not null references public.cash_sessions(id) on delete cascade,
  store_id          uuid not null references public.stores(id),
  type              public.cash_adjustment_type not null,
  amount            numeric(12,2) not null check (amount > 0),
  reason            text not null,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);

create index idx_cash_adjustments_session on public.cash_adjustments(cash_session_id);

-- ---------------------------------------------------------------------
-- Vues analytiques
-- ---------------------------------------------------------------------
create or replace view public.v_sales_detail
with (security_invoker = true) as
select
  s.id,
  s.reference,
  s.store_id,
  st.name as store_name,
  s.customer_id,
  c.name as customer_name,
  s.sold_by,
  pr.full_name as sold_by_name,
  s.sale_date,
  s.subtotal,
  s.discount_percent,
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
  s.created_at
from public.sales s
join public.stores st on st.id = s.store_id
left join public.customers c on c.id = s.customer_id
left join public.profiles pr on pr.id = s.sold_by;

create or replace view public.v_customer_receivables
with (security_invoker = true) as
select
  c.id as customer_id,
  c.name as customer_name,
  c.phone,
  c.credit_limit,
  count(s.id) filter (where s.amount_due > 0 and s.status = 'completed') as unpaid_sales_count,
  coalesce(sum(s.amount_due) filter (where s.status = 'completed'), 0) as total_due
from public.customers c
left join public.sales s on s.customer_id = c.id
group by c.id;

create or replace view public.v_supplier_payables
with (security_invoker = true) as
select
  sup.id as supplier_id,
  sup.name as supplier_name,
  sup.phone,
  count(po.id) filter (where po.amount_due > 0 and po.status <> 'cancelled') as unpaid_orders_count,
  coalesce(sum(po.amount_due) filter (where po.status <> 'cancelled'), 0) as total_due
from public.suppliers sup
left join public.purchase_orders po on po.supplier_id = sup.id
group by sup.id;
