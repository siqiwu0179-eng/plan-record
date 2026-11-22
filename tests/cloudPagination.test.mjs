import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function loadModule(entry, fake = false) {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm',
    plugins: fake ? [{ name: 'fake-client', setup(builder) {
      builder.onResolve({ filter: /\/lib\/supabase$/ }, () => ({ path: 'client', namespace: 'fake' }));
      builder.onResolve({ filter: /\/analytics$/ }, () => ({ path: 'analytics', namespace: 'fake' }));
      builder.onLoad({ filter: /.*/, namespace: 'fake' }, ({ path }) => ({ contents: path === 'client'
        ? 'export const supabase = { from: name => globalThis.paginationClient.from(name) };'
        : 'export const trackAnalytics = () => {};'
      }));
    } }] : [],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { loadAllRows } = await loadModule('src/utils/loadAllRows.ts');
const { loadCloudData } = await loadModule('src/utils/cloud.ts', true);
const { loadLongTermWorkspace } = await loadModule('src/utils/longTermCloud.ts', true);

test('reads beyond 1000 rows, exact page boundaries, empty tables, and a reduced API cap', async () => {
  for (const count of [0, 500, 1000, 1105, 1167, 2501]) {
    for (const cap of [1000, 73]) {
      const source = Array.from({ length: count }, (_, id) => ({ id }));
      const rows = await loadAllRows(async (from, to) => ({
        data: source.slice(from, Math.min(to + 1, from + cap)), count, error: null,
      }));
      assert.deepEqual(rows, source);
    }
  }
});
test('a later-page failure rejects the entire load instead of returning a partial history', async () => {
  const failure = new Error('network failure');
  await assert.rejects(loadAllRows(async from => from ? { error: failure } : {
    data: Array(500).fill({}), count: 1105, error: null,
  }), error => error === failure);
});
test('fails visibly when count is missing, changes, or the response stops early', async () => {
  for (const second of [
    { data: [], count: 1105, error: null },
    { data: [{}], count: 1106, error: null },
    { data: [{}], count: null, error: null },
  ]) {
    await assert.rejects(loadAllRows(async from => from ? second : {
      data: Array(500).fill({}), count: 1105, error: null,
    }));
  }
});

function clientFor(tables, cap = 1000) {
  const calls = [];
  return { calls, from(name) {
    const filters = [], order = [];
    let from = 0, to = Infinity, exact = false;
    const query = {
      select(_columns, options) { exact = options?.count === 'exact'; return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      is(key, value) { return query.eq(key, value); },
      order(key) { order.push(key); return query; },
      range(start, end) { from = start; to = end; return query; },
      maybeSingle() { return Promise.resolve({ data: (tables[name] ?? [])[0] ?? null, error: null }); },
      then(resolve, reject) {
        calls.push({ name, from, to, exact, order });
        const rows = (tables[name] ?? []).filter(row => filters.every(filter => filter(row)))
          .toSorted((a, b) => {
            for (const key of order) { if (a[key] < b[key]) return -1; if (a[key] > b[key]) return 1; }
            return 0;
          });
        return Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + cap)), count: exact ? rows.length : null, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
}
test('refresh reconstructs all tasks and completion states, with owner and soft-delete filtering', async () => {
  const user_id = 'owner';
  const timestamp = '2026-11-21T12:00:00Z';
  const tasks = Array.from({ length: 1167 }, (_, index) => ({
    user_id, id: `task-${String(index).padStart(4, '0')}`, task_date: index >= 1000 ? '2026-11-21' : '2026-11-09',
    title: `Task ${index}`, category: 'study', sort_order: index,
    created_at: timestamp, updated_at: timestamp, deleted_at: index < 62 ? timestamp : null,
  }));
  globalThis.paginationClient = clientFor({
    plan_tasks: [...tasks, { ...tasks[0], id: 'another-owner', user_id: 'other', deleted_at: null }],
    task_completions: tasks.map(task => ({ user_id, task_id: task.id, completed: true, updated_at: timestamp })),
    mood_records: [], travel_records: [],
  });
  for (let refresh = 0; refresh < 2; refresh++) {
    const loaded = await loadCloudData({ user: { id: user_id } });
    const visible = Object.values(loaded.plans).flatMap(week => week.days.flatMap(day => day.tasks));
    assert.equal(visible.length, 1105);
    assert.equal(new Set(visible.map(task => task.id)).size, 1105);
    assert.equal(visible.filter(task => task.completed).length, 1105);
    assert.equal(visible.find(task => task.id === 'task-1166')?.completed, true);
  }
  for (const name of ['plan_tasks', 'task_completions']) {
    assert.ok(globalThis.paginationClient.calls.some(call => call.name === name && call.from === 1000));
  }
});
test('mood, travel, and long-term history also paginate beyond the API cap', async () => {
  const user_id = 'owner';
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    user_id, id: `record-${i}`, deleted_at: null, record_date: `date-${i}`, mood: 3, entry: '', tags: [],
    sort_order: 0, from_city: 'A', to_city: 'B', start_date: '2026-11-21', end_date: '2026-11-21', color: '#fff',
    title: `Record ${i}`, tasks: [], details: {}, description: '', updated_at: '2026-11-21T12:00:00Z',
  }));
  globalThis.paginationClient = clientFor({ mood_records: rows, travel_records: rows, long_term_plans: rows });
  const loaded = await loadCloudData({ user: { id: user_id } });
  assert.equal(Object.keys(loaded.moods).length, 1001);
  assert.equal(loaded.travelRoutes.length, 1001);
  const workspace = await loadLongTermWorkspace(user_id);
  assert.equal(workspace.plans.length, 1001);
  assert.equal(Object.keys(workspace.versions).length, 1001);
});
