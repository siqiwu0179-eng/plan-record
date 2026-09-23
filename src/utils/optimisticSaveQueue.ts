/** Serializes optimistic snapshots against the latest confirmed server version. */
export function createOptimisticSaveQueue<T, Snapshot = T>(initial: T, options: {
  save: (confirmed: T, next: Snapshot) => Promise<T>;
  display: (value: T | Snapshot) => void;
  confirmed: (value: T) => void;
  failed: (error: unknown) => void;
  pending: (value: boolean) => void;
}) {
  let confirmed = initial;
  let visible: T | Snapshot = initial;
  let accepting = true;
  let active = true;
  let running = false;
  const queue: { next: Snapshot; resolve: (saved: boolean) => void }[] = [];
  async function drain() {
    if (running) return;
    running = true;
    while (active && queue.length) {
      const item = queue[0];
      try {
        const saved = await options.save(confirmed, item.next);
        if (!active) break;
        confirmed = saved;
        queue.shift();
        options.confirmed(saved);
        if (!queue.length) { visible = saved; options.display(saved); }
        item.resolve(true);
      } catch (error) {
        if (!active) break;
        // Later snapshots depend on the failed change, so discard them together.
        const rejected = queue.splice(0);
        visible = confirmed;
        options.display(confirmed);
        options.failed(error);
        rejected.forEach(entry => entry.resolve(false));
      }
    }
    running = false;
    if (active) options.pending(false);
  }
  return {
    current: () => visible,
    reset(value: T) {
      if (running || queue.length) throw new Error("Cannot reset pending saves");
      confirmed = value;
      visible = value;
    },
    enqueue(next: Snapshot): Promise<boolean> {
      if (!active || !accepting) return Promise.resolve(false);
      visible = next;
      options.display(next);
      options.pending(true);
      const result = new Promise<boolean>(resolve => queue.push({ next, resolve }));
      void drain();
      return result;
    },
    // Stop accepting UI work, but finish already accepted changes after navigation.
    detach() { accepting = false; },
    dispose() {
      active = false;
      queue.splice(0).forEach(entry => entry.resolve(false));
    },
  };
}

// A remounted view must wait for its previous instance's accepted saves.
const pendingSaves = new Map<string, Set<Promise<boolean>>>();
export function trackPendingSave(owner: string, save: Promise<boolean>) {
  const pending = pendingSaves.get(owner) ?? new Set<Promise<boolean>>();
  pendingSaves.set(owner, pending);
  pending.add(save);
  void save.finally(() => {
    pending.delete(save);
    if (!pending.size) pendingSaves.delete(owner);
  });
  return save;
}
export async function waitForPendingSaves(owner: string) {
  while (pendingSaves.get(owner)?.size) {
    await Promise.all(pendingSaves.get(owner) ?? []);
  }
}
