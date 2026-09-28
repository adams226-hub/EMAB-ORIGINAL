-- =====================================================================
-- EMAB ERP — Le Caissier peut désormais réaliser un inventaire complet
-- (créer, compter, soumettre et valider), limité à son propre magasin.
-- Auparavant il pouvait seulement consulter la page Inventaire ; créer
-- un inventaire (RLS stock_counts_insert) et le valider
-- (fn_validate_stock_count) lui étaient refusés.
-- =====================================================================

alter policy stock_counts_insert on public.stock_counts
  with check (
    (my_role() = any (array['super_admin'::user_role, 'manager'::user_role, 'cashier'::user_role, 'stock_keeper'::user_role]))
    and (is_super_admin() or my_role() = 'manager'::user_role or (store_id = my_store_id()))
  );

create or replace function public.fn_validate_stock_count(p_count_id uuid)
returns public.stock_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count public.stock_counts;
  v_item record;
  v_delta numeric(12,2);
begin
  select * into v_count from public.stock_counts where id = p_count_id for update;

  if v_count.id is null or v_count.tenant_id <> public.my_tenant_id() then
    raise exception 'Inventaire introuvable';
  end if;

  if v_count.status <> 'submitted' then
    raise exception 'Seul un inventaire soumis peut être validé';
  end if;

  if not (
    public.is_super_admin()
    or public.my_role() = 'manager'
    or (public.my_role() = 'cashier' and public.my_store_id() = v_count.store_id)
  ) then
    raise exception 'Non autorisé à valider cet inventaire';
  end if;

  for v_item in select * from public.stock_count_items where stock_count_id = p_count_id loop
    v_delta := coalesce(v_item.counted_quantity, 0) - v_item.expected_quantity;

    if v_delta > 0 then
      insert into public.stock_movements (type, product_id, store_id, quantity, reference_type, reference_id, created_by)
      values ('inventory_correction_in', v_item.product_id, v_count.store_id, v_delta, 'inventory', p_count_id, auth.uid());
    elsif v_delta < 0 then
      insert into public.stock_movements (type, product_id, store_id, quantity, reference_type, reference_id, created_by)
      values ('inventory_correction_out', v_item.product_id, v_count.store_id, -v_delta, 'inventory', p_count_id, auth.uid());
    end if;
  end loop;

  update public.stock_counts
  set status = 'validated', validated_by = auth.uid(), validated_at = now()
  where id = p_count_id
  returning * into v_count;

  return v_count;
end;
$$;
