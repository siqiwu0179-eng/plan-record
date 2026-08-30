-- Preserve the legacy source. The application will keep public.user_data as a
-- rollback source until the normalized model has passed its observation period.
insert into recovery.user_data_backups (user_id, user_data, profile, note)
select
  ud.user_id,
  to_jsonb(ud),
  to_jsonb(p),
  'Before normalized PlanRecord cutover; plans_md5=' || md5(ud.plans::text) ||
  '; moods_md5=' || md5(ud.moods::text) ||
  '; travel_md5=' || md5(ud.travel_routes::text)
from public.user_data ud
left join public.profiles p on p.user_id = ud.user_id;

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  motto text not null default '专注当下，记录成长，遇见更好的自己。',
  theme text not null default 'light' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  task_date date not null,
  category text not null check (category in ('study', 'exercise', 'diet', 'other')),
  title text not null check (length(btrim(title)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table public.task_completions (
  user_id uuid not null,
  task_id text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id),
  foreign key (user_id, task_id)
    references public.plan_tasks(user_id, id)
    on delete cascade,
  check ((completed and completed_at is not null) or (not completed))
);

create table public.mood_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  mood smallint not null check (mood between 1 and 5),
  entry text not null default '',
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, record_date)
);

create table public.travel_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  from_city text not null,
  to_city text not null,
  start_date date not null,
  end_date date not null,
  color text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  check (from_city <> to_city),
  check (end_date >= start_date)
);

create table public.long_term_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'archived')),
  target_date date,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index plan_tasks_user_date_idx on public.plan_tasks(user_id, task_date) where deleted_at is null;
create index task_completions_user_updated_idx on public.task_completions(user_id, updated_at desc);
create index mood_records_user_date_idx on public.mood_records(user_id, record_date desc) where deleted_at is null;
create index travel_records_user_start_date_idx on public.travel_records(user_id, start_date desc) where deleted_at is null;
create index long_term_plans_user_status_idx on public.long_term_plans(user_id, status, sort_order) where deleted_at is null;

alter table public.user_preferences enable row level security;
alter table public.plan_tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.mood_records enable row level security;
alter table public.travel_records enable row level security;
alter table public.long_term_plans enable row level security;

revoke all on table public.user_preferences, public.plan_tasks, public.task_completions,
  public.mood_records, public.travel_records, public.long_term_plans from anon, authenticated;
grant select, insert, update, delete on table public.user_preferences, public.plan_tasks,
  public.task_completions, public.mood_records, public.travel_records, public.long_term_plans to authenticated;

-- Remove broad privileges inherited from older project defaults. The legacy
-- frontend keeps only the SELECT/INSERT/UPDATE privileges it currently needs.
revoke truncate, references, trigger on table public.user_data, public.profiles from anon, authenticated;

create policy user_preferences_select_own on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy user_preferences_insert_own on public.user_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_preferences_update_own on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_preferences_delete_own on public.user_preferences for delete to authenticated using ((select auth.uid()) = user_id);

create policy plan_tasks_select_own on public.plan_tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_tasks_insert_own on public.plan_tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy plan_tasks_update_own on public.plan_tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy plan_tasks_delete_own on public.plan_tasks for delete to authenticated using ((select auth.uid()) = user_id);

create policy task_completions_select_own on public.task_completions for select to authenticated using ((select auth.uid()) = user_id);
create policy task_completions_insert_own on public.task_completions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy task_completions_update_own on public.task_completions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy task_completions_delete_own on public.task_completions for delete to authenticated using ((select auth.uid()) = user_id);

create policy mood_records_select_own on public.mood_records for select to authenticated using ((select auth.uid()) = user_id);
create policy mood_records_insert_own on public.mood_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy mood_records_update_own on public.mood_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy mood_records_delete_own on public.mood_records for delete to authenticated using ((select auth.uid()) = user_id);

create policy travel_records_select_own on public.travel_records for select to authenticated using ((select auth.uid()) = user_id);
create policy travel_records_insert_own on public.travel_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy travel_records_update_own on public.travel_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy travel_records_delete_own on public.travel_records for delete to authenticated using ((select auth.uid()) = user_id);

create policy long_term_plans_select_own on public.long_term_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy long_term_plans_insert_own on public.long_term_plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy long_term_plans_update_own on public.long_term_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy long_term_plans_delete_own on public.long_term_plans for delete to authenticated using ((select auth.uid()) = user_id);

insert into public.user_preferences (user_id, motto, theme, created_at, updated_at)
select user_id, motto, theme, created_at, updated_at from public.user_data;

with task_rows as (
  select ud.user_id, task.value as task, day.value as day, task.ordinality - 1 as sort_order,
    ud.created_at as fallback_created_at, ud.updated_at as fallback_updated_at
  from public.user_data ud
  cross join lateral jsonb_each(coalesce(ud.plans, '{}'::jsonb)) week
  cross join lateral jsonb_array_elements(coalesce(week.value->'days', '[]'::jsonb)) day
  cross join lateral jsonb_array_elements(coalesce(day.value->'tasks', '[]'::jsonb)) with ordinality as task(value, ordinality)
)
insert into public.plan_tasks (user_id, id, task_date, category, title, sort_order, created_at, updated_at)
select user_id, task->>'id', coalesce(nullif(task->>'date', ''), day->>'date')::date,
  task->>'category', task->>'title', sort_order::integer,
  case when coalesce(task->>'createdAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (task->>'createdAt')::timestamptz else fallback_created_at end,
  case when coalesce(task->>'updatedAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (task->>'updatedAt')::timestamptz else fallback_updated_at end
from task_rows;

with task_rows as (
  select ud.user_id, task.value as task, ud.updated_at as fallback_updated_at
  from public.user_data ud
  cross join lateral jsonb_each(coalesce(ud.plans, '{}'::jsonb)) week
  cross join lateral jsonb_array_elements(coalesce(week.value->'days', '[]'::jsonb)) day
  cross join lateral jsonb_array_elements(coalesce(day.value->'tasks', '[]'::jsonb)) task
)
insert into public.task_completions (user_id, task_id, completed, completed_at, updated_at)
select user_id, task->>'id', coalesce((task->>'completed')::boolean, false),
  case when coalesce((task->>'completed')::boolean, false) then
    case when coalesce(task->>'updatedAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (task->>'updatedAt')::timestamptz else fallback_updated_at end
  else null end,
  case when coalesce(task->>'updatedAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (task->>'updatedAt')::timestamptz else fallback_updated_at end
from task_rows;

with mood_rows as (
  select ud.user_id, mood.key as record_date, mood.value as mood, ud.created_at, ud.updated_at
  from public.user_data ud cross join lateral jsonb_each(coalesce(ud.moods, '{}'::jsonb)) mood
)
insert into public.mood_records (user_id, record_date, mood, entry, tags, created_at, updated_at)
select user_id, record_date::date, (mood->>'mood')::smallint, coalesce(mood->>'entry', ''),
  array(select jsonb_array_elements_text(coalesce(mood->'tags', '[]'::jsonb))), created_at, updated_at
from mood_rows;

with travel_rows as (
  select ud.user_id, route.value as route, route.ordinality - 1 as sort_order, ud.created_at, ud.updated_at
  from public.user_data ud
  cross join lateral jsonb_array_elements(coalesce(ud.travel_routes, '[]'::jsonb)) with ordinality as route(value, ordinality)
)
insert into public.travel_records (user_id, id, from_city, to_city, start_date, end_date, color, sort_order, created_at, updated_at)
select user_id, route->>'id', route->>'from', route->>'to', (route->>'date')::date,
  coalesce(nullif(route->>'endDate', ''), route->>'date')::date,
  coalesce(nullif(route->>'color', ''), '#3b82f6'), sort_order::integer, created_at, updated_at
from travel_rows;

create view public.weekly_completion_summary with (security_invoker = true) as
select
  t.user_id,
  date_trunc('week', t.task_date)::date as week_start_date,
  count(distinct t.task_date)::integer as planned_days,
  count(*)::integer as total_tasks,
  count(*) filter (where coalesce(c.completed, false))::integer as completed_tasks,
  round(100.0 * count(*) filter (where coalesce(c.completed, false)) / nullif(count(*), 0), 1) as completion_rate,
  max(greatest(t.updated_at, coalesce(c.updated_at, t.updated_at))) as calculated_from
from public.plan_tasks t
left join public.task_completions c on c.user_id = t.user_id and c.task_id = t.id
where t.deleted_at is null
group by t.user_id, date_trunc('week', t.task_date)::date;

revoke all on table public.weekly_completion_summary from anon, authenticated;
grant select on table public.weekly_completion_summary to authenticated;

create function public.save_user_preferences(p_motto text, p_theme text, p_updated_at timestamptz)
returns void language sql security invoker set search_path = '' as $$
  insert into public.user_preferences (user_id, motto, theme, updated_at)
  values ((select auth.uid()), p_motto, p_theme, p_updated_at)
  on conflict (user_id) do update set motto = excluded.motto, theme = excluded.theme, updated_at = excluded.updated_at
  where excluded.updated_at >= public.user_preferences.updated_at;
$$;

create function public.save_plan_task(p_id text, p_task_date date, p_category text, p_title text,
  p_sort_order integer, p_completed boolean, p_created_at timestamptz, p_updated_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.plan_tasks (user_id, id, task_date, category, title, sort_order, created_at, updated_at, deleted_at)
  values ((select auth.uid()), p_id, p_task_date, p_category, p_title, p_sort_order, p_created_at, p_updated_at, null)
  on conflict (user_id, id) do update set task_date = excluded.task_date, category = excluded.category,
    title = excluded.title, sort_order = excluded.sort_order, updated_at = excluded.updated_at, deleted_at = null
  where excluded.updated_at >= public.plan_tasks.updated_at;

  insert into public.task_completions (user_id, task_id, completed, completed_at, updated_at)
  values ((select auth.uid()), p_id, p_completed, case when p_completed then p_updated_at else null end, p_updated_at)
  on conflict (user_id, task_id) do update set completed = excluded.completed,
    completed_at = excluded.completed_at, updated_at = excluded.updated_at
  where excluded.updated_at >= public.task_completions.updated_at;
end;
$$;

create function public.delete_plan_task(p_id text, p_updated_at timestamptz)
returns void language sql security invoker set search_path = '' as $$
  update public.plan_tasks set deleted_at = p_updated_at, updated_at = p_updated_at
  where user_id = (select auth.uid()) and id = p_id and updated_at <= p_updated_at;
$$;

create function public.save_mood_record(p_record_date date, p_mood smallint, p_entry text, p_tags text[], p_updated_at timestamptz)
returns void language sql security invoker set search_path = '' as $$
  insert into public.mood_records (user_id, record_date, mood, entry, tags, updated_at, deleted_at)
  values ((select auth.uid()), p_record_date, p_mood, p_entry, p_tags, p_updated_at, null)
  on conflict (user_id, record_date) do update set mood = excluded.mood, entry = excluded.entry,
    tags = excluded.tags, updated_at = excluded.updated_at, deleted_at = null
  where excluded.updated_at >= public.mood_records.updated_at;
$$;

create function public.delete_mood_record(p_record_date date, p_updated_at timestamptz)
returns void language sql security invoker set search_path = '' as $$
  update public.mood_records set deleted_at = p_updated_at, updated_at = p_updated_at
  where user_id = (select auth.uid()) and record_date = p_record_date and updated_at <= p_updated_at;
$$;

create function public.save_travel_record(p_id text, p_from_city text, p_to_city text, p_start_date date,
  p_end_date date, p_color text, p_sort_order integer, p_updated_at timestamptz)
returns void language sql security invoker set search_path = '' as $$
  insert into public.travel_records (user_id, id, from_city, to_city, start_date, end_date, color, sort_order, updated_at, deleted_at)
  values ((select auth.uid()), p_id, p_from_city, p_to_city, p_start_date, p_end_date, p_color, p_sort_order, p_updated_at, null)
  on conflict (user_id, id) do update set from_city = excluded.from_city, to_city = excluded.to_city,
    start_date = excluded.start_date, end_date = excluded.end_date, color = excluded.color,
    sort_order = excluded.sort_order, updated_at = excluded.updated_at, deleted_at = null
  where excluded.updated_at >= public.travel_records.updated_at;
$$;

create function public.delete_travel_record(p_id text, p_updated_at timestamptz)
returns void language sql security invoker set search_path = '' as $$
  update public.travel_records set deleted_at = p_updated_at, updated_at = p_updated_at
  where user_id = (select auth.uid()) and id = p_id and updated_at <= p_updated_at;
$$;

revoke all on function public.save_user_preferences(text, text, timestamptz),
  public.save_plan_task(text, date, text, text, integer, boolean, timestamptz, timestamptz),
  public.delete_plan_task(text, timestamptz),
  public.save_mood_record(date, smallint, text, text[], timestamptz),
  public.delete_mood_record(date, timestamptz),
  public.save_travel_record(text, text, text, date, date, text, integer, timestamptz),
  public.delete_travel_record(text, timestamptz) from public, anon;

grant execute on function public.save_user_preferences(text, text, timestamptz),
  public.save_plan_task(text, date, text, text, integer, boolean, timestamptz, timestamptz),
  public.delete_plan_task(text, timestamptz),
  public.save_mood_record(date, smallint, text, text[], timestamptz),
  public.delete_mood_record(date, timestamptz),
  public.save_travel_record(text, text, text, date, date, text, integer, timestamptz),
  public.delete_travel_record(text, timestamptz) to authenticated;
