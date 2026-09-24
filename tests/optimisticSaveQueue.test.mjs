import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/utils/optimisticSaveQueue.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { createOptimisticSaveQueue } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
function harness() {
  const calls = [], displays = [], errors = [], pending = [];
  const queue = createOptimisticSaveQueue({ done: false, version: 0 }, {
    save: (before, next) => new Promise((resolve, reject) => calls.push({ before, next, resolve, reject })),
    display: value => displays.push(value), confirmed: () => {},
    failed: error => errors.push(error), pending: value => pending.push(value),
  });
  return { queue, calls, displays, errors, pending };
}
function keepDraftHarness() {
  const calls = [], displays = [], errors = [], pending = [];
  const queue = createOptimisticSaveQueue({ done: false, version: 0 }, {
    save: (before, next) => new Promise((resolve, reject) => calls.push({ before, next, resolve, reject })),
    display: value => displays.push(value), confirmed: () => {},
    failed: error => errors.push(error), pending: value => pending.push(value),
    rollbackOnError: false,
  });
  return { queue, calls, displays, errors, pending };
}
test('immediate display and serialized rapid toggles use latest server version', async () => {
  const h = harness();
  const a = h.queue.enqueue({ done: true, version: 0 });
  assert.equal(h.displays.at(-1).done, true);
  const b = h.queue.enqueue({ done: false, version: 0 });
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve({ done: true, version: 1 });
  await a;
  assert.equal(h.displays.at(-1).done, false);
  assert.equal(h.calls[1].before.version, 1);
  h.calls[1].resolve({ done: false, version: 2 });
  assert.equal(await b, true);
  assert.equal(h.queue.current().version, 2);
  assert.equal(h.pending.at(-1), false);
});
test('failure rolls back dependent snapshots and allows retry', async () => {
  const h = harness();
  const a = h.queue.enqueue({ done: true, version: 0 });
  const b = h.queue.enqueue({ done: false, version: 0 });
  h.calls[0].reject(new Error('conflict'));
  assert.deepEqual(await Promise.all([a, b]), [false, false]);
  assert.deepEqual(h.queue.current(), { done: false, version: 0 });
  assert.equal(h.calls.length, 1);
  assert.equal(h.errors.length, 1);
  const retry = h.queue.enqueue({ done: true, version: 0 });
  h.calls[1].resolve({ done: true, version: 1 });
  assert.equal(await retry, true);
});
test('failure can keep the latest visible draft for in-memory editing', async () => {
  const h = keepDraftHarness();
  const first = h.queue.enqueue({ done: true, version: 0 });
  const latest = h.queue.enqueue({ done: false, version: 99 });
  h.calls[0].reject(new Error('offline'));
  assert.deepEqual(await Promise.all([first, latest]), [false, false]);
  assert.deepEqual(h.queue.current(), { done: false, version: 99 });
  assert.equal(h.displays.at(-1).done, false);
  assert.equal(h.errors.length, 1);
});
test('disposed queue ignores late responses and cancels unsent changes', async () => {
  const h = harness();
  const a = h.queue.enqueue({ done: true, version: 0 });
  const b = h.queue.enqueue({ done: false, version: 0 });
  h.queue.dispose();
  const count = h.displays.length;
  h.calls[0].resolve({ done: true, version: 1 });
  assert.deepEqual(await Promise.all([a, b]), [false, false]);
  assert.equal(h.displays.length, count);
  assert.equal(h.calls.length, 1);
});
test('leaving the view finishes accepted saves before a remount reads cloud data', async () => {
  const { trackPendingSave, waitForPendingSaves } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const h = harness();
  const a = trackPendingSave('owner-a', h.queue.enqueue({ done: true, version: 0 }));
  const b = trackPendingSave('owner-a', h.queue.enqueue({ done: false, version: 0 }));
  h.queue.detach();
  let reloaded = false;
  const reload = waitForPendingSaves('owner-a').then(() => { reloaded = true; });
  await waitForPendingSaves('owner-b');
  assert.equal(reloaded, false);
  assert.equal(await h.queue.enqueue({ done: true, version: 0 }), false);
  h.calls[0].resolve({ done: true, version: 1 });
  await a;
  assert.equal(reloaded, false);
  h.calls[1].resolve({ done: false, version: 2 });
  assert.equal(await b, true);
  await reload;
  assert.equal(reloaded, true);
  assert.equal(h.calls.length, 2);
});
test('failure after a successful save rolls back to that last confirmed state', async () => {
  const h = harness();
  const a = h.queue.enqueue({ done: true, version: 0 });
  const b = h.queue.enqueue({ done: false, version: 0 });
  h.calls[0].resolve({ done: true, version: 1 });
  await a;
  h.calls[1].reject(new Error('offline'));
  assert.equal(await b, false);
  assert.deepEqual(h.queue.current(), { done: true, version: 1 });
});
test('confirmed edits refresh the baseline for subsequent checkbox saves', async () => {
  const h = harness();
  h.queue.reset({ done: false, version: 5 });
  const saved = h.queue.enqueue({ done: true, version: 5 });
  assert.equal(h.calls[0].before.version, 5);
  assert.throws(() => h.queue.reset({ done: false, version: 0 }));
  h.calls[0].resolve({ done: true, version: 6 });
  assert.equal(await saved, true);
});
