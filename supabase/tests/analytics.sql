-- Run through an administrative SQL connection. Every test is rolled back.
-- Existing business rows are read only. Trigger probes use temporary copies.
begin isolation level repeatable read;
create temporary table analytics_test_results (test text primary key, passed boolean not null);
create temporary table analytics_test_baseline as
select 'plan_tasks' name,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,id),'')) hash from public.plan_tasks t
union all select 'task_completions',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,task_id),'')) from public.task_completions t
union all select 'long_term_plans',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.long_term_plans t
union all select 'mood_records',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,record_date),'')) from public.mood_records t
union all select 'travel_records',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,id),'')) from public.travel_records t;

do $$
declare u uuid; d jsonb; expected bigint; ok boolean := false;
begin
 select user_id into u from analytics_private.readers limit 1;
 if u is null then raise exception 'A real Analytics reader is required'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 d := public.analytics_dashboard('2026-08-01','2026-10-12');
 select count(*) into expected from public.plan_tasks where deleted_at is null and task_date between '2026-08-01' and '2026-10-12';
 assert (d->'daily'->>'planned_tasks')::bigint=expected, 'Current task count mismatch';
 select count(*) into expected from public.plan_tasks t join public.task_completions c on t.user_id=c.user_id and t.id=c.task_id where t.deleted_at is null and c.completed and t.task_date between '2026-08-01' and '2026-10-12';
 assert (d->'daily'->>'currently_completed')::bigint=expected, 'Completion count mismatch';
 assert (select sum((c->>'tasks')::bigint) from jsonb_array_elements(d->'categories') c)=(d->'daily'->>'planned_tasks')::bigint, 'Category totals mismatch';
 assert (select sum((t->>'created')::bigint) from jsonb_array_elements(d->'trend') t)=(d->'daily'->>'created')::bigint, 'Creation trend mismatch';
 assert (select sum((t->>'completed')::bigint) from jsonb_array_elements(d->'trend') t)=(d->'daily'->>'completed')::bigint, 'Completion trend mismatch';
 assert jsonb_array_length(d->'trend')=73, 'Inclusive dates mismatch';
 assert jsonb_typeof(d->'retention'->0)='object', 'Retention row shape mismatch';
 assert not exists(select 1 from jsonb_array_elements(d->'retention') r where (r->>'retained')::bigint>(r->>'eligible')::bigint), 'Retention exceeds denominator';
 assert d->'kpi'->'north_star'='null'::jsonb, 'Uncovered window must not produce North Star';
 insert into analytics_test_results values ('real data counts, category sums, trend sums and immature windows',true);
 d := public.analytics_dashboard('2000-01-01','2000-01-02');
 assert (d->'daily'->>'created')::int=0 and (d->'kpi'->>'new_users')::int=0, 'Empty period must be zero';
 assert jsonb_array_length(d->'trend')=2, 'Empty days must be present';
 insert into analytics_test_results values ('empty range and calendar gap filling',true);
 begin perform public.analytics_dashboard('2026-10-12','2026-10-01'); exception when others then ok := SQLERRM like 'Select a valid range%'; end;
 assert ok, 'Reversed range accepted'; ok := false;
 begin perform public.analytics_dashboard('2000-01-01','2026-10-01'); exception when others then ok := SQLERRM like 'Select a valid range%'; end;
 assert ok, 'Unbounded range accepted'; ok := false;
 begin perform public.analytics_dashboard(current_date+10,current_date+11); exception when others then ok := SQLERRM like 'Select a valid range%'; end;
 assert ok, 'Future range accepted';
 insert into analytics_test_results values ('invalid, future and oversized date ranges rejected',true);
end $$;

-- Real role privileges; no synthetic user/account creation.
set local role authenticated;
do $$
declare d jsonb; ok boolean := false;
begin
 d := public.analytics_dashboard('2026-10-01','2026-10-12');
 assert d is not null, 'Authorized reader cannot use RPC';
 begin perform 1 from analytics_private.events limit 1; exception when insufficient_privilege then ok := true; end;
 assert ok, 'Authenticated role can read raw events'; ok := false;
 begin insert into analytics_private.readers values (auth.uid()) on conflict do nothing; exception when insufficient_privilege then ok := true; end;
 assert ok, 'Self-grant of Analytics reader allowed';
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
 ok := false;
 begin perform public.analytics_dashboard('2026-10-01','2026-10-12'); exception when insufficient_privilege then ok := true; end;
 assert ok, 'Unauthorized identity accessed Analytics';
end $$;
reset role;
insert into analytics_test_results values ('authorized reader succeeds; raw events, self-grant and other identities denied',true);
set local role anon;
do $$
declare ok boolean := false;
begin
 begin perform public.analytics_dashboard('2026-10-01','2026-10-12'); exception when insufficient_privilege then ok := true; end;
 assert ok, 'Anonymous Analytics read allowed'; ok := false;
 begin perform public.analytics_track(gen_random_uuid(),'page_viewed','daily'); exception when insufficient_privilege then ok := true; end;
 assert ok, 'Anonymous event insert allowed';
end $$;
reset role;
insert into analytics_test_results values ('anonymous reads and writes denied',true);

-- The original tables are never updated. Copies are session-local and discarded.
create temporary table plan_tasks as select * from public.plan_tasks where deleted_at is null limit 1;
create temporary table task_completions as select * from public.task_completions where completed limit 1;
create temporary table long_term_plans as select * from public.long_term_plans where deleted_at is null and jsonb_array_length(tasks)>0 limit 1;
create trigger analytics_probe after insert or update on pg_temp.plan_tasks for each row execute function analytics_private.capture();
create trigger analytics_probe after insert or update on pg_temp.task_completions for each row execute function analytics_private.capture();
create trigger analytics_probe after insert or update on pg_temp.long_term_plans for each row execute function analytics_private.capture();
do $$
declare n bigint; k bigint; uid uuid; tid text; sid text; gid text; eventid uuid := gen_random_uuid(); ok boolean := false;
begin
 select count(*) into n from analytics_private.events;
 update pg_temp.plan_tasks set title=title;
 update pg_temp.task_completions set completed=completed;
 update pg_temp.long_term_plans set tasks=tasks;
 assert (select count(*) from analytics_private.events)=n, 'No-op saves duplicated events';
 insert into analytics_test_results values ('repeated saves do not duplicate business events',true);
 update pg_temp.plan_tasks set task_date=task_date+1;
 assert (select count(*) from analytics_private.events where event_name='task_carried_over' and source='database')>=1, 'Date change not captured';
 update pg_temp.plan_tasks set deleted_at=now();
 assert (select count(*) from analytics_private.events)=n+2, 'Deletion/date change count mismatch';
 update pg_temp.task_completions set completed=false;
 update pg_temp.task_completions set completed=true;
 assert (select count(*) from analytics_private.events)=n+3, 'Completion transition not captured';
 update pg_temp.long_term_plans set tasks=jsonb_set(tasks,'{0,done}','false');
 select count(*) into k from analytics_private.events;
 update pg_temp.long_term_plans set tasks=jsonb_set(tasks,'{0,done}','true');
 assert (select count(*) from analytics_private.events)=k+1, 'Step completion not captured';
 insert into analytics_test_results values ('date change, soft deletion, completion and step transition capture',true);
 select user_id,id::text,tasks->0->>'id' into uid,gid,sid from public.long_term_plans where deleted_at is null and jsonb_array_length(tasks)>0 limit 1;
 select id into tid from public.plan_tasks where user_id=uid and deleted_at is null limit 1;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 select count(*) into n from analytics_private.events;
 perform public.analytics_track(eventid,'page_viewed','daily');
 perform public.analytics_track(eventid,'page_viewed','daily');
 assert (select count(*) from analytics_private.events)=n+1, 'Retry ID not idempotent';
 perform public.analytics_track(gen_random_uuid(),'longterm_step_added_to_daily','longterm',tid,jsonb_build_object('goal_id',gid,'step_id',sid));
 perform public.analytics_track(gen_random_uuid(),'longterm_step_added_to_daily','longterm',tid,jsonb_build_object('goal_id',gid,'step_id',sid));
 assert (select count(*) from analytics_private.events)=n+2, 'Daily link not idempotent';
 begin perform public.analytics_track(gen_random_uuid(),'task_created','daily'); exception when others then ok := SQLERRM='Invalid analytics event'; end;
 assert ok, 'Client could forge database events'; ok := false;
 begin perform public.analytics_track(gen_random_uuid(),'longterm_step_added_to_daily','longterm',tid,'{}'); exception when others then ok := SQLERRM='Invalid step/task reference'; end;
 assert ok, 'Invalid step association accepted';
 insert into analytics_test_results values ('RPC retries, successful task references and invalid event rejection',true);
end $$;

-- Fail-open: malformed telemetry on a temporary business row cannot abort its save.
do $$
declare n bigint;
begin
 select count(*) into n from analytics_private.events;
 update pg_temp.plan_tasks set user_id=null,task_date=task_date+1;
 assert exists(select 1 from pg_temp.plan_tasks where user_id is null), 'Analytics failure aborted business write';
 assert (select count(*) from analytics_private.events)=n, 'Failed capture left partial event';
 insert into analytics_test_results values ('capture failure does not abort business operation',true);
end $$;

-- INSERT paths use copies of real rows; remove corresponding Analytics keys only
-- inside this rolled-back transaction so the event dedupe can be observed afresh.
create temporary table users as select id from auth.users limit 1;
create temporary table mood_records as select user_id,record_date from public.mood_records limit 1;
create temporary table travel_records as select user_id,id from public.travel_records limit 1;
create trigger analytics_probe after insert on pg_temp.users for each row execute function analytics_private.capture();
create trigger analytics_probe after insert on pg_temp.mood_records for each row execute function analytics_private.capture();
create trigger analytics_probe after insert on pg_temp.travel_records for each row execute function analytics_private.capture();
do $$
declare n bigint; first_step jsonb;
begin
 delete from analytics_private.events where event_key in (
  select 'signup:'||id from pg_temp.users union all
  select 'mood:'||user_id||':'||record_date from pg_temp.mood_records union all
  select 'travel:'||user_id||':'||id from pg_temp.travel_records union all
  select 'goal:'||id from pg_temp.long_term_plans);
 select count(*) into n from analytics_private.events;
 insert into pg_temp.users select * from pg_temp.users;
 insert into pg_temp.mood_records select * from pg_temp.mood_records;
 insert into pg_temp.travel_records select * from pg_temp.travel_records;
 insert into pg_temp.long_term_plans select * from pg_temp.long_term_plans;
 assert exists(select 1 from analytics_private.events where event_name='user_signed_up' and source='database'), 'Signup insert capture missing';
 assert exists(select 1 from analytics_private.events where event_name='mood_created' and source='database'), 'Mood insert capture missing';
 assert exists(select 1 from analytics_private.events where event_name='travel_created' and source='database'), 'Travel insert capture missing';
 assert exists(select 1 from analytics_private.events where event_name='goal_created' and source='database'), 'Goal insert capture missing';
 assert exists(select 1 from analytics_private.events where event_name='longterm_step_created' and source='database'), 'Step creation capture missing';
 -- Restore a valid real task into its temp copy; business originals stay untouched.
 truncate pg_temp.plan_tasks;
 delete from analytics_private.events where event_key=(select 'task:'||user_id||':'||id from public.plan_tasks where deleted_at is null limit 1);
 insert into pg_temp.plan_tasks select * from public.plan_tasks where deleted_at is null limit 1;
 assert exists(select 1 from analytics_private.events where event_name='task_created' and source='database'), 'Task insert capture missing';
 insert into analytics_test_results values ('signup, task, goal, step, mood and travel insert capture',true);
end $$;

-- Verify originals against their transaction-start hashes.
create temporary table analytics_test_after as
select 'plan_tasks' name,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,id),'')) hash from public.plan_tasks t
union all select 'task_completions',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,task_id),'')) from public.task_completions t
union all select 'long_term_plans',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.long_term_plans t
union all select 'mood_records',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,record_date),'')) from public.mood_records t
union all select 'travel_records',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,id),'')) from public.travel_records t;
do $$ begin
 assert not exists(select * from analytics_test_baseline except select * from analytics_test_after), 'Original business rows changed';
end $$;
insert into analytics_test_results values ('all original business row hashes unchanged',true);
select * from analytics_test_results order by test;
rollback;
