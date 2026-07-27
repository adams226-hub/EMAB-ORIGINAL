-- =====================================================================
-- EMAB ERP — Phase 5 — Multi-tenant SaaS : inscription self-service
-- Remplace handle_new_user() (Phase 1) pour distinguer deux parcours :
--   1. Une nouvelle entreprise s'inscrit elle-même (/signup)
--      → création d'un tenant + premier compte super_admin
--   2. Un super_admin existant invite un collègue (module Utilisateurs)
--      → le nouvel utilisateur rejoint le MÊME tenant (jamais un nouveau)
-- =====================================================================

create or replace function public.slugify_tenant_name(p_name text)
returns text
language sql
as $$
  select lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(md5(random()::text), 1, 6);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_tenant_name text;
begin
  v_tenant_name := new.raw_user_meta_data->>'tenant_name';

  if v_tenant_name is not null then
    insert into public.tenants (name, slug)
    values (v_tenant_name, public.slugify_tenant_name(v_tenant_name))
    returning id into v_tenant_id;

    insert into public.profiles (id, full_name, email, role, store_id, tenant_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email,
      'super_admin',
      null,
      v_tenant_id
    );
  else
    v_tenant_id := nullif(new.raw_user_meta_data->>'tenant_id', '')::uuid;

    if v_tenant_id is null then
      raise exception 'tenant_id est requis pour inviter un utilisateur dans une entreprise existante';
    end if;

    insert into public.profiles (id, full_name, email, role, store_id, tenant_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email,
      coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'cashier'),
      nullif(new.raw_user_meta_data->>'store_id', '')::uuid,
      v_tenant_id
    );
  end if;

  return new;
end;
$$;
