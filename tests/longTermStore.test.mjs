import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/utils/longTermStore.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'fake-cloud', setup(builder) {
    builder.onResolve({ filter: /\/longTermCloud$/ }, () => ({ path: 'cloud', namespace: 'fake' }));
    builder.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: `
      export const emptyWorkspace = () => ({ plans: [], details: {}, compass: { vision: '', creed: '', fiveYears: '' }, versions: {}, compassVersion: null });
      export const loadLongTermWorkspace = owner => globalThis.testCloud.load(owner);
      export const saveLongTermWorkspace = (...args) => globalThis.testCloud.savePlans(...args);
      export const saveLongTermCompass = (...args) => globalThis.testCloud.saveCompass(...args);
      export const saveErrorText = error => error.message;
    ` }));
  } }],
});
const { createLongTermStore, getLongTermStore, clearLongTermStores } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const initial = () => ({
  plans: [{ id: 'p', name: 'Original', color: '#C7DCCF', tasks: [{id:'s',title:'Step',done:false}] }],
  details: { p: {goal:'Goal',tone:'blue',paused:false,notes:[],resources:[],ideas:[]} },
  compass: {vision:'Vision',creed:'',fiveYears:''}, versions:{p:'v1'}, compassVersion:'c1',
});
function setup() {
  clearLongTermStores();
  const loads=[], plans=[], compass=[];
  globalThis.testCloud = {
    load(owner) { const d=deferred(); loads.push({owner,...d}); return d.promise; },
    savePlans(before,next,owner) { const d=deferred(); plans.push({before,next,owner,...d}); return d.promise; },
    saveCompass(before,next,owner) { const d=deferred(); compass.push({before,next,owner,...d}); return d.promise; },
  };
  const store=getLongTermStore('a');
  const hydrate=async () => { const pending=store.refresh(); loads.at(-1).resolve(initial()); await pending; };
  return {store,loads,plans,compass,hydrate};
}
test('prefetch is shared; navigation keeps content while a background read is pending', async () => {
  const h=setup(); const first=h.store.refresh(); const second=h.store.refresh();
  assert.equal(h.loads.length,1); assert.equal(first,second);
  h.loads[0].resolve(initial()); await first;
  assert.equal(getLongTermStore('a'),h.store);
  const background=h.store.refresh();
  assert.equal(h.store.getSnapshot().ready,true);
  assert.equal(h.store.getSnapshot().workspace.plans[0].name,'Original');
  h.loads[1].resolve(initial()); await background;
});
test('text saves, new entries, and checkbox changes render immediately and serialize', async () => {
  const h=setup(); await h.hydrate();
  const renamed=structuredClone(h.store.getSnapshot().workspace); renamed.plans[0].name='Renamed';
  assert.equal(h.store.updatePlans(renamed),true);
  assert.equal(h.store.getSnapshot().workspace.plans[0].name,'Renamed');
  const next=structuredClone(h.store.getSnapshot().workspace);
  next.details.p.notes.push({id:'n',title:'Note',content:'New text'}); next.plans[0].tasks[0].done=true;
  h.store.updatePlans(next);
  assert.equal(h.plans.length,1);
  assert.equal(h.store.getSnapshot().workspace.details.p.notes[0].content,'New text');
  h.plans[0].resolve({...renamed,versions:{p:'v2'}}); await tick();
  assert.equal(h.plans[1].before.versions.p,'v2');
  assert.equal(h.store.getSnapshot().workspace.plans[0].tasks[0].done,true);
  h.plans[1].resolve({...next,versions:{p:'v3'}}); await tick();
  assert.equal(h.store.getSnapshot().planPending,false);
});
test('plan edits and compass edits do not overwrite each other or their versions', async () => {
  const h=setup(); await h.hydrate();
  const plan=structuredClone(h.store.getSnapshot().workspace); plan.plans[0].name='Changed';
  h.store.updatePlans(plan); h.store.updateCompass({vision:'New vision',creed:'',fiveYears:''});
  assert.equal(h.store.getSnapshot().workspace.compass.vision,'New vision');
  h.compass[0].resolve({...initial(),compass:{vision:'New vision',creed:'',fiveYears:''},compassVersion:'c2'}); await tick();
  h.plans[0].resolve({...plan,versions:{p:'v2'}}); await tick();
  assert.equal(h.store.getSnapshot().workspace.compassVersion,'c2');
  assert.equal(h.store.getSnapshot().workspace.compass.vision,'New vision');
  assert.equal(h.store.getSnapshot().workspace.plans[0].name,'Changed');
  h.store.updateCompass({vision:'Third',creed:'',fiveYears:''});
  assert.equal(h.compass[1].before.compassVersion,'c2');
  h.compass[1].resolve({...initial(),compass:{vision:'Third',creed:'',fiveYears:''},compassVersion:'c3'}); await tick();
});
test('a stale read cannot overwrite a newer edit, even after its save completed', async () => {
  const h=setup(); await h.hydrate(); const background=h.store.refresh();
  const next=structuredClone(initial()); next.plans[0].name='New'; h.store.updatePlans(next);
  h.plans[0].resolve({...next,versions:{p:'v2'}}); await tick();
  h.loads[1].resolve(initial()); await background;
  assert.equal(h.store.getSnapshot().workspace.plans[0].name,'New');
  assert.equal(h.store.getSnapshot().workspace.versions.p,'v2');
});
test('failure retains the latest unsaved text across navigation and blocks cloud refresh from replacing it', async () => {
  const h=setup(); await h.hydrate();
  const next=structuredClone(initial()); next.details.p.goal='Do not lose this'; h.store.updatePlans(next);
  const latest=structuredClone(next); latest.details.p.notes.push({id:'n',title:'Draft',content:'Keep me'}); h.store.updatePlans(latest);
  h.plans[0].reject(new Error('conflict')); await tick();
  assert.equal(h.plans.length,1);
  const remounted=getLongTermStore('a').getSnapshot();
  assert.equal(remounted.workspace.details.p.goal,'Do not lose this');
  assert.equal(remounted.workspace.details.p.notes[0].content,'Keep me');
  await h.store.refresh();
  assert.equal(h.loads.length,1);
  assert.match(remounted.error,/conflict/);
});
test('pending saves survive unsubscribing and are instantly visible on reentry', async () => {
  const h=setup(); await h.hydrate(); const unsubscribe=h.store.subscribe(()=>{});
  const next=structuredClone(initial()); next.plans[0].name='Pending'; h.store.updatePlans(next);
  unsubscribe(); await getLongTermStore('a').refresh();
  assert.equal(h.loads.length,1); assert.equal(getLongTermStore('a').getSnapshot().workspace.plans[0].name,'Pending');
  h.plans[0].resolve({...next,versions:{p:'v2'}}); await tick();
  assert.equal(getLongTermStore('a').getSnapshot().planPending,false);
});
test('logout clears cached content and prevents late responses or queued writes leaking', async () => {
  const h=setup(); await h.hydrate();
  const next=structuredClone(initial()); next.plans[0].name='Private'; h.store.updatePlans(next); h.store.updatePlans(next);
  clearLongTermStores();
  h.plans[0].resolve({...next,versions:{p:'v2'}}); await tick();
  assert.equal(h.plans.length,1);
  assert.equal(h.store.getSnapshot().ready,false);
  assert.equal(getLongTermStore('b').getSnapshot().workspace.plans.length,0);
  assert.equal(getLongTermStore('a').getSnapshot().workspace.plans.length,0);
});
