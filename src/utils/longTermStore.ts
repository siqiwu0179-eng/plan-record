import { emptyWorkspace, loadLongTermWorkspace, saveLongTermWorkspace, saveLongTermCompass, saveErrorText, type Workspace } from "./longTermCloud";
import { createOptimisticSaveQueue } from "./optimisticSaveQueue";
import type { Compass, PlanState } from "./longTermLocal";

type State = {
  workspace: Workspace;
  ready: boolean;
  planPending: boolean;
  compassPending: boolean;
  error: string;
  dirty: boolean;
};

// Account-scoped memory survives page navigation, but never replaces cloud storage.
export function createLongTermStore(userId: string) {
  let state: State = { workspace: emptyWorkspace(), ready: false, planPending: false, compassPending: false, error: "", dirty: false };
  let alive = true;
  let revision = 0;
  let loading: Promise<void> | null = null;
  let planDirty = false;
  let compassDirty = false;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<State>) => {
    if (!alive) return;
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const reportFailure = (error: unknown) => {
    const message = saveErrorText(error);
    publish({ error: message, dirty: true });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("plan-record-save-error", { detail: { label: "长期计划", message } }));
    }
  };
  const plans = createOptimisticSaveQueue<Workspace, PlanState>(state.workspace, {
    save: (before, next) => saveLongTermWorkspace(before, next, userId),
    display: value => {
      revision++;
      publish({ workspace: { ...state.workspace, plans: value.plans, details: value.details } });
    },
    confirmed: value => {
      planDirty = false;
      publish({ workspace: { ...state.workspace, versions: value.versions }, dirty: planDirty || compassDirty });
    },
    failed: error => reportFailure(error),
    pending: value => publish({ planPending: value }),
    rollbackOnError: false,
  });
  const compass = createOptimisticSaveQueue<Workspace, Compass>(state.workspace, {
    save: (before, next) => saveLongTermCompass(before, next, userId),
    display: value => {
      revision++;
      publish({ workspace: { ...state.workspace, compass: "compass" in value ? value.compass : value } });
    },
    confirmed: value => {
      compassDirty = false;
      publish({ workspace: { ...state.workspace, compassVersion: value.compassVersion }, dirty: planDirty || compassDirty });
    },
    failed: error => reportFailure(error),
    pending: value => publish({ compassPending: value }),
    rollbackOnError: false,
  });
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh() {
      if (!alive || state.planPending || state.compassPending || state.dirty) return Promise.resolve();
      if (loading) return loading;
      const startedAt = revision;
      loading = loadLongTermWorkspace(userId).then(workspace => {
        // A read started before an edit must never overwrite that edit or its versions.
        if (!alive || revision !== startedAt || state.planPending || state.compassPending) return;
      plans.reset(workspace);
      compass.reset(workspace);
        planDirty = false;
        compassDirty = false;
        publish({ workspace, ready: true });
      }).catch(error => {
        if (alive && revision === startedAt) publish({ error: `云端读取失败，请重试。${saveErrorText(error)}` });
      }).finally(() => { loading = null; });
      return loading;
    },
    updatePlans(next: PlanState) {
      if (!alive || !state.ready) return false;
      planDirty = true;
      void plans.enqueue({ plans: next.plans, details: next.details });
      publish({ error: "", dirty: planDirty || compassDirty });
      return true; // Accepted locally; cloud confirmation is intentionally asynchronous.
    },
    updateCompass(next: Compass) {
      if (!alive || !state.ready) return false;
      compassDirty = true;
      void compass.enqueue(next);
      publish({ error: "", dirty: planDirty || compassDirty });
      return true;
    },
    dispose() {
      alive = false;
      plans.dispose(); compass.dispose();
      listeners.clear();
      state = { ...state, workspace: emptyWorkspace(), ready: false, error: "", dirty: false };
    },
  };
}

const stores = new Map<string, ReturnType<typeof createLongTermStore>>();
export function getLongTermStore(userId: string) {
  let store = stores.get(userId);
  if (!store) { store = createLongTermStore(userId); stores.set(userId, store); }
  return store;
}
export function clearLongTermStores() {
  stores.forEach(store => store.dispose());
  stores.clear();
}
