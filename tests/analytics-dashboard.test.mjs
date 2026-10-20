import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const html = await readFile('analytics.html','utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function harness(fetch) {
  const nodes = new Map();
  const document = {getElementById(id){
    if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',replaceChildren(){this.innerHTML='';},classList:{toggle(){}}});
    return nodes.get(id);
  }};
  const context=vm.createContext({document,fetch,AbortSignal,Intl,Date,console});
  vm.runInContext(script,context);
  vm.runInContext("session={access_token:'transport-test-only',expires_at:Date.now()+3600000};",context);
  return {context,nodes,run:code=>vm.runInContext(code,context)};
}
test('RPC errors hide previous results but retain filters and retry without requiring another login',async()=>{
  const h=harness(async()=>({ok:false,json:async()=>({message:'Select a valid range'})}));
  await h.run('load()');
  assert.equal(h.nodes.get('report').hidden,true);
  assert.equal(h.nodes.get('dashboard').hidden,false);
  assert.equal(h.nodes.get('login').hidden,true);
  assert.equal(h.nodes.get('refresh').disabled,false);
  assert.match(h.nodes.get('status').textContent,/Select a valid range/);
});
test('logout during a pending request prevents stale results or errors reappearing',async()=>{
  let reject;
  const h=harness(()=>new Promise((_,r)=>{reject=r;}));
  const loading=h.run('load()');
  h.run('clear()');reject(new Error('connection lost'));
  await loading;
  assert.equal(h.nodes.get('dashboard').hidden,true);
  assert.equal(h.nodes.get('login').hidden,false);
  assert.equal(h.run('session'),null);
});
test('transport failures are visible and never presented as zero-valued data',async()=>{
  const h=harness(async()=>{throw new Error('network unavailable');});
  await h.run('load()');
  assert.equal(h.nodes.get('report').hidden,true);
  assert.match(h.nodes.get('status').textContent,/network unavailable/);
  assert.equal(h.run('latest'),null);
});
test('week buckets span year boundaries and zero denominators have no invented percentage',()=>{
  const h=harness(()=>{throw new Error('not used');});
  assert.equal(h.run("bucket('2027-01-01','week')"),'2026-12-28');
  assert.equal(h.run("bucket('2026-10-13','month')"),'2026-10');
  assert.equal(h.run('rate(0,0)'),'No data');
  assert.equal(h.run('number(null)'),'No data');
});
