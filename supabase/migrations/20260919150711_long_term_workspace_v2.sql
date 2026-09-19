-- Additive upgrade. Existing rows, columns, RPCs and soft-deleted records are retained.
alter table public.long_term_plans add column if not exists details jsonb not null default '{}'::jsonb;
do $$ begin
 if not exists (select 1 from pg_constraint where conname='long_term_plans_details_object' and conrelid='public.long_term_plans'::regclass) then
  alter table public.long_term_plans add constraint long_term_plans_details_object check (jsonb_typeof(details)='object');
 end if;
end $$;

create table if not exists public.long_term_compass (
 user_id uuid primary key references auth.users(id),
 vision text not null default '',
 creed text not null default '',
 five_years text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.long_term_compass enable row level security;
do $$ begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='long_term_compass' and policyname='long_term_compass_own') then
  create policy long_term_compass_own on public.long_term_compass for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
 end if;
end $$;
revoke all on public.long_term_compass from anon;
grant select,insert,update on public.long_term_compass to authenticated;

-- One transaction for each UI action. Exact version checks reject stale tabs.
create or replace function public.save_long_term_workspace_v2(p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare c jsonb; patch jsonb; r public.long_term_plans; result jsonb := '{}'::jsonb; stamp timestamptz; entry jsonb; k text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_changes) <> 'array' then raise exception 'Invalid changes'; end if;
 for c in select value from jsonb_array_elements(p_changes) order by value->>'id' loop
  patch := c->'patch';
  if jsonb_typeof(patch) <> 'object' then raise exception 'Invalid patch'; end if;
  select * into r from public.long_term_plans where id=(c->>'id')::uuid and user_id=auth.uid() for update;
  if found then
   if r.deleted_at is not null or (c->>'expected') is null or r.updated_at is distinct from (c->>'expected')::timestamptz then raise exception 'Edit conflict: reload before saving' using errcode='40001'; end if;
  else
   if (c->>'expected') is not null or coalesce((patch->>'deleted')::boolean,false) then raise exception 'Edit conflict: missing plan' using errcode='40001'; end if;
   insert into public.long_term_plans(id,user_id,title) values ((c->>'id')::uuid,auth.uid(),btrim(patch->>'title')) returning * into r;
  end if;
  stamp := greatest(clock_timestamp(),r.updated_at+interval '1 microsecond');
  if coalesce((patch->>'deleted')::boolean,false) then
   update public.long_term_plans set deleted_at=stamp,updated_at=stamp where id=r.id;
  else
   if patch ? 'tasks' then
    if jsonb_typeof(patch->'tasks') <> 'array' then raise exception 'Invalid steps'; end if;
    for entry in select value from jsonb_array_elements(patch->'tasks') loop
     if jsonb_typeof(entry) <> 'object' or coalesce(entry->>'id','')='' or coalesce(btrim(entry->>'title'),'')='' or jsonb_typeof(entry->'done') is distinct from 'boolean' then raise exception 'Invalid step'; end if;
    end loop;
   end if;
   if patch ? 'details' then
    if jsonb_typeof(patch->'details') <> 'object' then raise exception 'Invalid details'; end if;
    foreach k in array array['notes','resources','ideas'] loop
     if jsonb_typeof(patch->'details'->k) is distinct from 'array' then raise exception 'Invalid entries'; end if;
     for entry in select value from jsonb_array_elements(patch->'details'->k) loop
      if jsonb_typeof(entry) <> 'object' or coalesce(entry->>'id','')='' or coalesce(btrim(entry->>'title'),'')='' or jsonb_typeof(entry->'content') is distinct from 'string' then raise exception 'Invalid entry'; end if;
     end loop;
    end loop;
    if jsonb_typeof(patch->'details'->'paused') is distinct from 'boolean' then raise exception 'Invalid paused status'; end if;
   end if;
   update public.long_term_plans set
    title=case when patch ? 'title' then btrim(patch->>'title') else r.title end,
    color=case when patch ? 'color' then patch->>'color' else r.color end,
    tasks=case when patch ? 'tasks' then patch->'tasks' else r.tasks end,
    description=case when patch ? 'description' then patch->>'description' else r.description end,
    details=case when patch ? 'details' then patch->'details' else r.details end,
    sort_order=case when patch ? 'sort_order' then (patch->>'sort_order')::integer else r.sort_order end,
    updated_at=stamp
   where id=r.id;
   -- Completed progress is derived from the same steps saved in this transaction.
   if patch ? 'tasks' or patch ? 'details' then
    update public.long_term_plans set status=case
     when coalesce((details->>'paused')::boolean,status='archived') then 'archived'
     when jsonb_array_length(tasks)>0 and not exists (select 1 from jsonb_array_elements(tasks) s where s->>'done' is distinct from 'true') then 'completed'
     else 'active' end where id=r.id;
   end if;
  end if;
  result := result || jsonb_build_object(r.id::text,stamp);
 end loop;
 return result;
end $$;

create or replace function public.save_long_term_compass_v2(p_value jsonb,p_expected timestamptz)
returns timestamptz language plpgsql security invoker set search_path=public as $$
declare r public.long_term_compass; stamp timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_value->'vision') is distinct from 'string' or jsonb_typeof(p_value->'creed') is distinct from 'string' or jsonb_typeof(p_value->'fiveYears') is distinct from 'string' then raise exception 'Invalid compass'; end if;
 select * into r from public.long_term_compass where user_id=auth.uid() for update;
 if found then
  if p_expected is null or r.updated_at is distinct from p_expected then raise exception 'Edit conflict: reload before saving' using errcode='40001'; end if;
  stamp := greatest(clock_timestamp(),r.updated_at+interval '1 microsecond');
  update public.long_term_compass set vision=p_value->>'vision',creed=p_value->>'creed',five_years=p_value->>'fiveYears',updated_at=stamp where user_id=auth.uid();
 else
  if p_expected is not null then raise exception 'Edit conflict: missing compass' using errcode='40001'; end if;
  stamp := clock_timestamp();
  insert into public.long_term_compass(user_id,vision,creed,five_years,updated_at) values(auth.uid(),p_value->>'vision',p_value->>'creed',p_value->>'fiveYears',stamp);
 end if;
 return stamp;
end $$;
revoke all on function public.save_long_term_workspace_v2(jsonb),public.save_long_term_compass_v2(jsonb,timestamptz) from public,anon;
grant execute on function public.save_long_term_workspace_v2(jsonb),public.save_long_term_compass_v2(jsonb,timestamptz) to authenticated;
