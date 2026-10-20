-- Analytics is additive. No updates/deletes to existing business rows.
create schema if not exists analytics_private;
revoke all on schema analytics_private from public, anon, authenticated;
grant usage on schema analytics_private to authenticated;
create table analytics_private.settings (singleton boolean primary key default true check(singleton), started_at timestamptz not null default clock_timestamp());
insert into analytics_private.settings default values;
create table analytics_private.readers (user_id uuid primary key references auth.users(id) on delete cascade);
insert into analytics_private.readers(user_id) values ('13f6d5f3-d53d-4551-bab1-8daaada87417');
create table analytics_private.events (
 id uuid primary key default gen_random_uuid(), event_key text not null unique,
 event_name text not null check(event_name in ('user_signed_up','user_logged_in','page_viewed','task_created','task_completed','task_deleted','task_carried_over','goal_created','longterm_step_created','longterm_step_completed','longterm_step_added_to_daily','mood_created','travel_created')),
 user_id uuid not null references auth.users(id) on delete cascade,
 occurred_at timestamptz not null default clock_timestamp(), received_at timestamptz not null default clock_timestamp(),
 module text not null, object_id text, properties jsonb not null default '{}'::jsonb,
 source text not null check(source in ('database','client','history'))
);
create index analytics_events_time on analytics_private.events(occurred_at,event_name);
create index analytics_events_user_time on analytics_private.events(user_id,occurred_at);
create index analytics_events_object on analytics_private.events(user_id,object_id,event_name);
alter table analytics_private.events enable row level security;
alter table analytics_private.readers enable row level security;
alter table analytics_private.settings enable row level security;
revoke all on all tables in schema analytics_private from public,anon,authenticated;

-- Only verifiable historical facts; never synthesize page views, login, or step timestamps.
insert into analytics_private.events(event_key,event_name,user_id,occurred_at,module,object_id,properties,source)
select 'signup:'||id,'user_signed_up',id,created_at,'auth',id::text,'{}','history' from auth.users
union all select 'task:'||user_id||':'||id,'task_created',user_id,created_at,'daily',id,jsonb_build_object('category',category,'task_date',task_date),'history' from public.plan_tasks
union all select 'history-complete:'||c.user_id||':'||c.task_id,'task_completed',c.user_id,c.completed_at,'daily',c.task_id,jsonb_build_object('category',t.category,'historical_current_state',true),'history' from public.task_completions c join public.plan_tasks t on t.user_id=c.user_id and t.id=c.task_id where c.completed and c.completed_at is not null
union all select 'goal:'||id,'goal_created',user_id,created_at,'longterm',id::text,'{}','history' from public.long_term_plans
union all select 'mood:'||user_id||':'||record_date,'mood_created',user_id,created_at,'mood',record_date::text,'{}','history' from public.mood_records
union all select 'travel:'||user_id||':'||id,'travel_created',user_id,created_at,'travel',id,'{}','history' from public.travel_records;

create function analytics_private.capture() returns trigger language plpgsql security definer set search_path='' as $$
declare n jsonb := to_jsonb(new); o jsonb := case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
u uuid; obj text; ev text; mod text; props jsonb := '{}'::jsonb; s jsonb; previous jsonb;
begin
 u := coalesce(n->>'user_id',n->>'id')::uuid;
 obj := coalesce(n->>'id',n->>'task_id',n->>'record_date');
 if tg_table_name='users' then
  ev := 'user_signed_up'; mod := 'auth';
 elsif tg_table_name='plan_tasks' then
  mod := 'daily'; props := jsonb_build_object('category',n->>'category','task_date',n->>'task_date');
  if tg_op='INSERT' then ev := 'task_created';
  elsif n->>'deleted_at' is not null and o->>'deleted_at' is null then ev := 'task_deleted';
  elsif n->>'task_date' is distinct from o->>'task_date' then ev := 'task_carried_over'; props := props || jsonb_build_object('from_date',o->>'task_date'); end if;
 elsif tg_table_name='task_completions' then
  mod := 'daily';
  if n->>'completed'='true' and o->>'completed' is distinct from 'true' then
   ev := 'task_completed'; select jsonb_build_object('category',category) into props from public.plan_tasks where user_id=u and id=obj;
  end if;
 elsif tg_table_name='long_term_plans' then
  mod := 'longterm';
  if tg_op='INSERT' then ev := 'goal_created'; end if;
  if n->>'deleted_at' is null then
   for s in select value from jsonb_array_elements(coalesce(n->'tasks','[]')) loop
    select value into previous from jsonb_array_elements(coalesce(o->'tasks','[]')) where value->>'id'=s->>'id';
    if previous is null then
     insert into analytics_private.events(event_key,event_name,user_id,module,object_id,properties,source) values ('step:'||u||':'||obj||':'||(s->>'id'),'longterm_step_created',u,mod,obj||':'||(s->>'id'),jsonb_build_object('goal_id',obj,'step_id',s->>'id'),'database') on conflict(event_key) do nothing;
    end if;
    if s->>'done'='true' and previous->>'done' is distinct from 'true' then
     insert into analytics_private.events(event_key,event_name,user_id,module,object_id,properties,source) values (gen_random_uuid()::text,'longterm_step_completed',u,mod,obj||':'||(s->>'id'),jsonb_build_object('goal_id',obj,'step_id',s->>'id'),'database');
    end if;
   end loop;
  end if;
 elsif tg_table_name='mood_records' and tg_op='INSERT' then ev := 'mood_created'; mod := 'mood';
 elsif tg_table_name='travel_records' and tg_op='INSERT' then ev := 'travel_created'; mod := 'travel';
 end if;
 if ev is not null then
  insert into analytics_private.events(event_key,event_name,user_id,module,object_id,properties,source)
  values (case ev when 'user_signed_up' then 'signup:'||u when 'task_created' then 'task:'||u||':'||obj when 'goal_created' then 'goal:'||obj when 'mood_created' then 'mood:'||u||':'||obj when 'travel_created' then 'travel:'||u||':'||obj else gen_random_uuid()::text end,ev,u,mod,obj,coalesce(props,'{}'),'database') on conflict(event_key) do nothing;
 end if;
 return new;
exception when others then
 -- Analytics must not abort a business save. Log errors for operational diagnosis.
 raise warning 'Analytics capture failed [%]: %',SQLSTATE,SQLERRM;
 return new;
end $$;
revoke all on function analytics_private.capture() from public,anon,authenticated;
create trigger analytics_capture after insert on auth.users for each row execute function analytics_private.capture();
create trigger analytics_capture after insert or update on public.plan_tasks for each row execute function analytics_private.capture();
create trigger analytics_capture after insert or update on public.task_completions for each row execute function analytics_private.capture();
create trigger analytics_capture after insert or update on public.long_term_plans for each row execute function analytics_private.capture();
create trigger analytics_capture after insert on public.mood_records for each row execute function analytics_private.capture();
create trigger analytics_capture after insert on public.travel_records for each row execute function analytics_private.capture();

create function analytics_private.track(p_id uuid,p_event text,p_module text,p_object text,p_properties jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_event not in ('user_logged_in','page_viewed','longterm_step_added_to_daily') or p_module not in ('auth','home','daily','longterm','completion','travel','mood') or jsonb_typeof(p_properties) is distinct from 'object' or octet_length(p_properties::text)>1024 then raise exception 'Invalid analytics event'; end if;
 if p_event='longterm_step_added_to_daily' then
  if p_module <> 'longterm' or not exists(select 1 from public.plan_tasks where user_id=u and id=p_object) or not exists(select 1 from public.long_term_plans l cross join lateral jsonb_array_elements(l.tasks) s where l.user_id=u and l.id::text=p_properties->>'goal_id' and s->>'id'=p_properties->>'step_id') then raise exception 'Invalid step/task reference'; end if;
  p_properties := jsonb_build_object('goal_id',p_properties->>'goal_id','step_id',p_properties->>'step_id');
 else
  p_properties := '{}'::jsonb;
 end if;
 insert into analytics_private.events(id,event_key,event_name,user_id,module,object_id,properties,source)
 values(p_id,case when p_event='longterm_step_added_to_daily' then 'daily-link:'||u||':'||p_object else p_id::text end,p_event,u,p_module,left(p_object,200),p_properties,'client') on conflict do nothing;
end $$;
revoke all on function analytics_private.track(uuid,text,text,text,jsonb) from public,anon;
grant execute on function analytics_private.track(uuid,text,text,text,jsonb) to authenticated;
create function public.analytics_track(p_id uuid,p_event text,p_module text,p_object text default null,p_properties jsonb default '{}') returns void language sql security invoker set search_path='' as $$ select analytics_private.track(p_id,p_event,p_module,p_object,p_properties) $$;
revoke all on function public.analytics_track(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.analytics_track(uuid,text,text,text,jsonb) to authenticated;
create function analytics_private.dashboard(p_start date,p_end date) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; coverage timestamptz; today date := (now() at time zone 'Asia/Shanghai')::date;
begin
 if auth.uid() is null or not exists(select 1 from analytics_private.readers where user_id=auth.uid()) then raise exception 'Analytics access denied' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_start>p_end or p_end>today or p_end-p_start>730 then raise exception 'Select a valid range of up to 731 days, ending no later than today'; end if;
 select started_at into coverage from analytics_private.settings;
 with
 e as (select *, (occurred_at at time zone 'Asia/Shanghai')::date d from analytics_private.events),
 activity as (select distinct user_id,d from e where source<>'history' and event_name<>'user_signed_up'),
 selected_activity as (select * from activity where d between p_start and p_end),
 completions as (select user_id,object_id,min(d) d from e where event_name='task_completed' group by user_id,object_id),
 creations as (select user_id,object_id,min(d) d from e where event_name='task_created' group by user_id,object_id),
 tasks as (select t.*,coalesce(c.completed,false) completed from public.plan_tasks t left join public.task_completions c on c.user_id=t.user_id and c.task_id=t.id where t.deleted_at is null and t.task_date between p_start and p_end),
 daily as (select day::date d from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') day),
 trend as (select d,
 (select count(distinct user_id) from activity a where a.d=daily.d) dau,
 (select count(distinct user_id) from activity a where a.d between daily.d-6 and daily.d) wau,
 (select count(distinct user_id) from activity a where a.d between daily.d-29 and daily.d) mau,
 (select count(*) from creations c where c.d=daily.d) created,
 (select count(*) from completions c where c.d=daily.d) completed from daily),
 users as (select id,(created_at at time zone 'Asia/Shanghai')::date joined from auth.users),
 cohort as (select * from users where joined between p_start and p_end),
 funnel as (select c.*, (select min(d) from creations t where t.user_id=c.id and t.d>=c.joined) first_create,(select min(d) from completions t where t.user_id=c.id and t.d>=c.joined) first_complete from cohort c),
 retained as (select offset_days,
 (select count(*) from cohort c where c.joined>=(coverage at time zone 'Asia/Shanghai')::date+1 and c.joined+offset_days<=least(p_end,today-1)) eligible,
 (select count(*) from cohort c where c.joined>=(coverage at time zone 'Asia/Shanghai')::date+1 and c.joined+offset_days<=least(p_end,today-1) and exists(select 1 from activity a where a.user_id=c.id and a.d=c.joined+offset_days)) retained
 from unnest(array[1,7,30]) offset_days),
 features as (select m.module,count(distinct e.user_id) users,count(e.id) uses from unnest(array['daily','longterm','completion','travel','mood']) m(module) left join e on e.module=m.module and e.event_name='page_viewed' and e.d between p_start and p_end group by m.module),
 steps as (select l.user_id,l.id goal_id,s from public.long_term_plans l cross join lateral jsonb_array_elements(l.tasks) s where l.deleted_at is null),
 step_counts as (select count(*) total,count(*) filter(where s->>'done'='true') completed,
 count(*) filter(where exists(select 1 from e where e.event_name='longterm_step_added_to_daily' and e.user_id=steps.user_id and e.properties->>'goal_id'=steps.goal_id::text and e.properties->>'step_id'=steps.s->>'id' and e.d between p_start and p_end)) converted from steps),
 prior_active as (select distinct user_id from activity where d between p_end-59 and p_end-30),
 churn as (select count(*) eligible,count(*) filter(where not exists(select 1 from activity a where a.user_id=prior_active.user_id and a.d between p_end-29 and p_end)) churned from prior_active)
 select jsonb_build_object(
 'meta',jsonb_build_object('start',p_start,'end',p_end,'timezone','Asia/Shanghai','tracking_started_at',coverage,'generated_at',now(),'activity_complete_since',(coverage at time zone 'Asia/Shanghai')::date+1,'historical_completion','Historical completions are the last recorded completion of tasks still marked complete at migration; earlier transitions cannot be recovered.'),
 'kpi',jsonb_build_object('dau',(select dau from trend where d=p_end),'wau',(select wau from trend where d=p_end),'mau',(select mau from trend where d=p_end),'new_users',(select count(*) from cohort),'active_users',(select count(distinct user_id) from selected_activity),'weekly_completed_tasks',(select count(*) from completions where d between p_end-6 and p_end),'weekly_active_users',(select count(distinct user_id) from activity where d between p_end-6 and p_end), 'north_star',case when p_end-6 >= (coverage at time zone 'Asia/Shanghai')::date+1 then (select count(*)::numeric from completions where d between p_end-6 and p_end)/nullif((select count(distinct user_id) from activity where d between p_end-6 and p_end),0) else null end),
 'daily',jsonb_build_object('created',(select count(*) from creations where d between p_start and p_end),'completed',(select count(*) from completions where d between p_start and p_end),'planned_tasks',(select count(*) from tasks),'currently_completed',(select count(*) from tasks where completed),'active_plan_days',(select count(distinct task_date) from tasks),'user_plan_days',(select count(distinct (user_id,task_date)) from tasks),'completed_per_active_user',case when p_start>=(coverage at time zone 'Asia/Shanghai')::date+1 then (select count(*)::numeric from completions where d between p_start and p_end)/nullif((select count(distinct user_id) from selected_activity),0) else null end),
 'trend',coalesce((select jsonb_agg(to_jsonb(trend) order by d) from trend),'[]'),
 'periods',jsonb_build_object('week',(select coalesce(jsonb_agg(x order by period),'[]') from (select date_trunc('week',d)::date period,count(distinct user_id) active_users from selected_activity group by 1) x),'month',(select coalesce(jsonb_agg(x order by period),'[]') from (select date_trunc('month',d)::date period,count(distinct user_id) active_users from selected_activity group by 1) x)),
 'retention',(select jsonb_agg(to_jsonb(r) order by offset_days) from retained r),
 'churn',(select jsonb_build_object('eligible',eligible,'churned',churned,'complete',p_end-59 >= (coverage at time zone 'Asia/Shanghai')::date+1) from churn),
 'funnel',jsonb_build_object('registered',(select count(*) from funnel),'created',(select count(*) from funnel where first_create between joined and p_end),'completed',(select count(*) from funnel where first_create between joined and p_end and first_complete between first_create and p_end),'retained_7d',(select count(*) from funnel f where joined>=(coverage at time zone 'Asia/Shanghai')::date+1 and joined+7<=least(p_end,today-1) and first_create between joined and p_end and first_complete between first_create and p_end and exists(select 1 from activity a where a.user_id=f.id and a.d>=greatest(joined+7,first_complete) and a.d<=p_end)),'eligible_7d',(select count(*) from funnel where joined>=(coverage at time zone 'Asia/Shanghai')::date+1 and joined+7<=least(p_end,today-1))),
 'categories',(select jsonb_agg(x) from (select cat category,count(t.id) tasks,count(t.id) filter(where t.completed) completed from unnest(array['study','exercise','diet','other']) cat left join tasks t on t.category=cat group by cat) x),
 'features',(select jsonb_agg(to_jsonb(features)) from features),
 'longterm',(select jsonb_build_object('goals',(select count(*) from public.long_term_plans where deleted_at is null),'steps',total,'completed_steps',completed,'converted_steps',converted,'new_goals',(select count(*) from e where event_name='goal_created' and d between p_start and p_end),'new_steps',(select count(*) from e where event_name='longterm_step_created' and d between p_start and p_end),'step_completions',(select count(distinct (user_id,object_id)) from e where event_name='longterm_step_completed' and d between p_start and p_end)) from step_counts)
 ) into result;
 return result;
end $$;
revoke all on function analytics_private.dashboard(date,date) from public,anon;
grant execute on function analytics_private.dashboard(date,date) to authenticated;
create function public.analytics_dashboard(p_start date,p_end date) returns jsonb language sql security invoker set search_path='' as $$ select analytics_private.dashboard(p_start,p_end) $$;
revoke all on function public.analytics_dashboard(date,date) from public,anon;
grant execute on function public.analytics_dashboard(date,date) to authenticated;
