alter table public.long_term_plans
  add column if not exists color text not null default '#C7DCCF',
  add column if not exists tasks jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'long_term_plans_color_check'
      and conrelid = 'public.long_term_plans'::regclass
  ) then
    alter table public.long_term_plans
      add constraint long_term_plans_color_check
      check (color = any (array['#C7DCCF', '#D8D1E6', '#F6E8B8', '#FFD8B5', '#DDAAA1', '#E6E2DD']));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'long_term_plans_tasks_check'
      and conrelid = 'public.long_term_plans'::regclass
  ) then
    alter table public.long_term_plans
      add constraint long_term_plans_tasks_check
      check (jsonb_typeof(tasks) = 'array');
  end if;
end
$$;

create or replace function public.save_long_term_plan(
  p_id uuid,
  p_title text,
  p_color text,
  p_tasks jsonb,
  p_sort_order integer,
  p_updated_at timestamptz
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.long_term_plans (
    id, user_id, title, color, tasks, sort_order, status, updated_at, deleted_at
  ) values (
    p_id, auth.uid(), btrim(p_title), p_color, coalesce(p_tasks, '[]'::jsonb),
    greatest(coalesce(p_sort_order, 0), 0), 'active', p_updated_at, null
  )
  on conflict (id) do update set
    title = excluded.title,
    color = excluded.color,
    tasks = excluded.tasks,
    sort_order = excluded.sort_order,
    status = 'active',
    updated_at = excluded.updated_at,
    deleted_at = null
  where long_term_plans.user_id = auth.uid()
    and excluded.updated_at >= long_term_plans.updated_at;
end;
$$;

create or replace function public.delete_long_term_plan(
  p_id uuid,
  p_updated_at timestamptz
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.long_term_plans
  set deleted_at = p_updated_at, updated_at = p_updated_at
  where id = p_id and user_id = auth.uid() and p_updated_at >= updated_at;
end;
$$;

revoke all on function public.save_long_term_plan(uuid, text, text, jsonb, integer, timestamptz),
  public.delete_long_term_plan(uuid, timestamptz) from public, anon;
grant execute on function public.save_long_term_plan(uuid, text, text, jsonb, integer, timestamptz),
  public.delete_long_term_plan(uuid, timestamptz) to authenticated;
