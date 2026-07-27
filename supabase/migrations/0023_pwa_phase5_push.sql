-- =====================================================================
-- EMAB ERP — Phase 5 — Notifications push (PWA)
-- Stocke les abonnements Web Push par utilisateur/appareil. L'envoi
-- effectif se fait côté serveur Next.js (clé privée VAPID, jamais en
-- base) via lib/notifications/push.ts.
-- =====================================================================

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth_key      text not null,
  created_at    timestamptz not null default now()
);

create trigger trg_set_tenant_id
  before insert on public.push_subscriptions
  for each row execute function public.set_tenant_id();

create index idx_push_subscriptions_user on public.push_subscriptions(user_id);
create index idx_push_subscriptions_tenant_store on public.push_subscriptions(tenant_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (user_id = auth.uid());

create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (user_id = auth.uid());

create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (user_id = auth.uid());

create policy tenant_isolation on public.push_subscriptions as restrictive
  for all
  using (tenant_id = public.my_tenant_id())
  with check (tenant_id = public.my_tenant_id());
