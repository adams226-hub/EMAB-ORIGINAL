-- =====================================================================
-- EMAB ERP — Phase 5 — Journal d'audit
-- Capture qui a créé/modifié/supprimé quoi et quand, sur les tables où
-- une traçabilité "métier" a du sens (entités et documents). Les
-- lignes de détail et les grands livres déjà immuables (stock_movements,
-- payments, sale_items...) ne sont volontairement PAS ré-audités ici :
-- ils sont déjà, par construction, leur propre trace d'audit.
-- =====================================================================

create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id),
  table_name    text not null,
  record_id     uuid not null,
  action        text not null check (action in ('insert', 'update', 'delete')),
  changed_by    uuid references public.profiles(id),
  old_data      jsonb,
  new_data      jsonb,
  created_at    timestamptz not null default now()
);

create index idx_audit_log_tenant_created on public.audit_log(tenant_id, created_at desc);
create index idx_audit_log_table_record on public.audit_log(table_name, record_id);

create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);

  insert into public.audit_log (tenant_id, table_name, record_id, action, changed_by, old_data, new_data)
  values (
    v_tenant_id,
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    lower(TG_OP),
    auth.uid(),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants', 'stores', 'profiles', 'categories', 'products', 'units', 'suppliers',
    'purchase_orders', 'stock_transfers', 'stock_counts',
    'payment_methods', 'customers', 'expense_categories', 'expenses',
    'sales', 'cash_sessions', 'cash_adjustments'
  ]
  loop
    execute format(
      'create trigger trg_audit_log after insert or update or delete on public.%I for each row execute function public.audit_trigger_fn();',
      t
    );
  end loop;
end $$;

create or replace view public.v_audit_log
with (security_invoker = true) as
select
  a.id,
  a.tenant_id,
  a.table_name,
  a.record_id,
  a.action,
  a.changed_by,
  p.full_name as changed_by_name,
  a.old_data,
  a.new_data,
  a.created_at
from public.audit_log a
left join public.profiles p on p.id = a.changed_by;

alter table public.audit_log enable row level security;

create policy "audit_log_select_super_admin" on public.audit_log
  for select using (public.is_super_admin());

create policy tenant_isolation on public.audit_log as restrictive
  for all
  using (tenant_id = public.my_tenant_id())
  with check (tenant_id = public.my_tenant_id());
