import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

// Transport doubles only. No fake metrics, production accounts or database writes.
const source = await readFile('src/utils/analytics.ts', 'utf8');
const { code } = await transform(source.replace('import { supabase } from "../lib/supabase";', 'const supabase = globalThis.testClient;'), { loader: 'ts', format: 'cjs' });
async function harness({ sessions = [{ user: { id: 'actor' }, access_token: 'actor-session' }], fail = 0, missingCrypto = false } = {}) {
  const calls = [], logs = [];
  let sessionRead = 0;
  const context = vm.createContext({
    exports: {}, module: { exports: {} },
    crypto: { randomUUID() { if (missingCrypto) throw new Error('unavailable'); return 'stable-event-id'; } },
    AbortSignal: { timeout: ms => ({ timeout: ms }) },
    setTimeout: fn => { queueMicrotask(fn); return 1; },
    console: { warn: (...args) => logs.push(args) },
    testClient: {
      auth: { getSession: async () => ({ data: { session: sessions[Math.min(sessionRead++, sessions.length - 1)] }, error: null }) },
      rpc(name, args) {
        const call = { name, args, headers: {} }; calls.push(call);
        return {
          setHeader(key, value) { call.headers[key] = value; return this; },
          abortSignal(signal) { call.signal = signal; return Promise.resolve({ error: calls.length <= fail ? new Error('offline') : null }); },
        };
      },
    },
  });
  vm.runInContext(code, context);
  return { track: context.module.exports.trackAnalytics, calls, logs, drain: async () => { for(let i=0;i<30;i++) await Promise.resolve(); } };
}
test('telemetry is non-blocking and retries with a stable ID and pinned actor token', async () => {
  const h = await harness({fail: 2});
  assert.equal(h.track('actor','page_viewed','daily'),undefined);
  await h.drain();
  assert.equal(h.calls.length,3);
  assert.equal(new Set(h.calls.map(c=>c.args.p_id)).size,1);
  assert.ok(h.calls.every(c=>c.headers.Authorization==='Bearer actor-session' && c.signal.timeout===5000));
});
test('account switch cancels remaining retries instead of attributing an old event to new user', async () => {
  const h = await harness({fail: 3,sessions:[{user:{id:'actor'},access_token:'old'},{user:{id:'another'},access_token:'new'}]});
  h.track('actor','page_viewed','daily'); await h.drain();
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].headers.Authorization,'Bearer old');
});
test('logged-out sessions never emit and missing crypto never breaks login',async()=>{
  const loggedOut=await harness({sessions:[null]});
  assert.doesNotThrow(()=>loggedOut.track('actor','user_logged_in','auth'));
  await loggedOut.drain();assert.equal(loggedOut.calls.length,0);
  const unsupported=await harness({missingCrypto:true});
  assert.doesNotThrow(()=>unsupported.track('actor','user_logged_in','auth'));
  await unsupported.drain();assert.equal(unsupported.calls.length,0);
});
test('exhausted transport failures are bounded and do not expose credentials in logs',async()=>{
  const h=await harness({fail:99});h.track('actor','page_viewed','daily');await h.drain();
  assert.equal(h.calls.length,3);assert.equal(h.logs.length,1);assert.ok(!JSON.stringify(h.logs).includes('actor-session'));
});
