import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { LongTermPlan } from "../types";
import {
  loadLongTermPlans,
  removeLongTermPlan,
  saveLongTermPlan,
} from "../utils/cloud";
import "./LongTermPlansOverlay.css";

type Position = { left: number; top: number };
type BridgeMessage = {
  source?: string;
  type?: "ready" | "projects-changed";
  projects?: unknown;
};

const BRIDGE_SOURCE = "plan-record-long-term-plans";
const PALETTE = ["#C7DCCF", "#D8D1E6", "#F6E8B8", "#FFD8B5", "#DDAAA1", "#E6E2DD"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizePlans = (value: unknown): LongTermPlan[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<LongTermPlan>;
    const name = String(candidate.name ?? "").trim();
    if (!name) return [];
    const rawId = String(candidate.id ?? "");
    return [{
      id: UUID_PATTERN.test(rawId) ? rawId : crypto.randomUUID(),
      name,
      color: PALETTE.includes(String(candidate.color)) ? String(candidate.color) : PALETTE[index % PALETTE.length],
      tasks: Array.isArray(candidate.tasks) ? candidate.tasks.flatMap((task) => {
        if (!task || typeof task !== "object") return [];
        const next = task as { id?: unknown; title?: unknown; done?: unknown };
        const title = String(next.title ?? "").trim();
        if (!title) return [];
        return [{ id: String(next.id || crypto.randomUUID()), title, done: Boolean(next.done) }];
      }) : [],
    }];
  });
};

const boundsForViewport = () => {
  const scale = window.innerWidth <= 760 ? 0.7 : 0.88;
  return { leftInset: 200 * scale, rightExtent: 440 * scale, topInset: 298 * scale, bottomExtent: 458 * scale };
};

const clampPosition = (position: Position): Position => {
  const bounds = boundsForViewport();
  const edge = 8;
  return {
    left: Math.min(Math.max(edge - bounds.leftInset, position.left), window.innerWidth - bounds.rightExtent - edge),
    top: Math.min(Math.max(edge - bounds.topInset, position.top), window.innerHeight - bounds.bottomExtent - edge),
  };
};

const defaultPosition = (): Position => clampPosition({
  left: window.innerWidth - 564 - 20,
  top: Math.max(72, Math.min(118, window.innerHeight * 0.12)),
});

const readPosition = (key: string): Position => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null") as Position | null;
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) return clampPosition(saved);
  } catch {
    // Use the visual default when an older saved value is malformed.
  }
  return defaultPosition();
};

const frameOverrides = `
  html, body, .plan-desk { width: 640px !important; height: 756px !important; min-height: 756px !important; overflow: hidden !important; background: transparent !important; }
  .plan-desk { padding: 0 !important; }
  .toast { bottom: 90px !important; }
  body, button, input { font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; }
  .folder-title, .card-heading h2, .new-project-panel-header strong { font-size: 16px !important; font-weight: 700 !important; letter-spacing: 0 !important; }
  .card-number, .card-preview, .progress-copy, .section-label, .empty-tasks,
  .folder-entry-view > .new-project-form > label, .plan-color-picker legend { color: #64748b !important; font-size: 12px !important; font-weight: 500 !important; letter-spacing: 0 !important; }
  .task-label, .edit-task-input, .card-footer input, .edit-title-input,
  .folder-entry-view > .new-project-form > input { font-size: 14px !important; font-weight: 400 !important; }
  .card-footer button, .edit-title-actions button,
  .folder-entry-view > .new-project-form .create-project-button { font-size: 14px !important; font-weight: 600 !important; }
  .folder-entry-view > .new-project-form { left: calc(50% + 136px) !important; }
  #card-stack:has(> .plan-card:nth-child(2):last-child) > .plan-card:nth-child(2),
  #card-stack:has(> .plan-card:nth-child(3):last-child) > .plan-card:nth-child(2) { --stack-y: -60px !important; }
  #card-stack:has(> .plan-card:nth-child(3):last-child) > .plan-card:nth-child(3) { --stack-y: -120px !important; }
  #card-stack:has(> .plan-card:nth-child(4):last-child) > .plan-card:nth-child(2) { --stack-y: -48px !important; }
  #card-stack:has(> .plan-card:nth-child(4):last-child) > .plan-card:nth-child(3) { --stack-y: -96px !important; }
  #card-stack:has(> .plan-card:nth-child(4):last-child) > .plan-card:nth-child(4) { --stack-y: -144px !important; }
  #folder-entry-view:has(#card-stack > .plan-card:nth-child(2):last-child) { --stack-rise: 68px !important; }
  #folder-entry-view:has(#card-stack > .plan-card:nth-child(3):last-child) { --stack-rise: 128px !important; }
  #folder-entry-view:has(#card-stack > .plan-card:nth-child(4):last-child) { --stack-rise: 152px !important; }
  .folder-entry-view.open:not(.has-active) .uiverse-file .plan-card:not(.active) { transform: translateX(-50%) translateY(calc(var(--stack-y) - 8px)) !important; }
  .folder-entry-view.open:not(.has-active) .uiverse-file .plan-card:not(.active):hover { transform: translateX(-50%) translateY(calc(var(--stack-y) - 16px)) !important; }
  .folder-entry-view.open:not(.has-active) #card-stack:has(> .plan-card:nth-child(4):last-child) > .plan-card:not(.active):hover { transform: translateX(-50%) translateY(calc(var(--stack-y) - 24px)) !important; }
`;

export function LongTermPlansOverlay({ session, cloudReady }: { session: Session | null; cloudReady: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const remoteIdsRef = useRef<Set<string>>(new Set());
  const remotePlansRef = useRef<LongTermPlan[]>([]);
  const cloudLoadedRef = useRef(false);
  const bootstrapRef = useRef<string | null>(null);
  const positionKey = `plan-record-long-term-position-home-v1:${session?.user.id ?? "guest"}`;
  const [position, setPosition] = useState<Position>(() => readPosition(positionKey));
  const positionRef = useRef(position);
  positionRef.current = position;

  const sendProjects = (projects: LongTermPlan[]) => {
    frameRef.current?.contentWindow?.postMessage({ source: BRIDGE_SOURCE, type: "set-projects", projects }, window.location.origin);
  };

  const persistSnapshot = async (projects: LongTermPlan[]) => {
    if (!session || !cloudReady) return;
    const nextIds = new Set(projects.map((plan) => plan.id));
    const deletedIds = [...remoteIdsRef.current].filter((id) => !nextIds.has(id));
    await Promise.all([
      ...projects.map((plan, index) => saveLongTermPlan(plan, index)),
      ...deletedIds.map((id) => removeLongTermPlan(id)),
    ]);
    remoteIdsRef.current = nextIds;
    remotePlansRef.current = projects;
  };

  useEffect(() => {
    const next = readPosition(positionKey);
    positionRef.current = next;
    setPosition(next);
  }, [positionKey]);

  useEffect(() => {
    cloudLoadedRef.current = false;
    bootstrapRef.current = null;
    remoteIdsRef.current = new Set();
    remotePlansRef.current = [];
    if (!session || !cloudReady) return;
    let cancelled = false;
    void loadLongTermPlans(session).then((plans) => {
      if (cancelled) return;
      remotePlansRef.current = plans;
      remoteIdsRef.current = new Set(plans.map((plan) => plan.id));
      cloudLoadedRef.current = true;
      if (plans.length) sendProjects(plans);
      else frameRef.current?.contentWindow?.postMessage({ source: BRIDGE_SOURCE, type: "request-projects" }, window.location.origin);
    }).catch((error) => console.error("Unable to load long-term plans", error));
    return () => { cancelled = true; };
  }, [session, cloudReady]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<BridgeMessage>) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.source !== BRIDGE_SOURCE) return;
      const incoming = normalizePlans(event.data.projects);
      if (event.data.type === "ready") {
        if (!session || !cloudReady || !cloudLoadedRef.current) return;
        if (remotePlansRef.current.length) return sendProjects(remotePlansRef.current);
        if (bootstrapRef.current === session.user.id) return;
        bootstrapRef.current = session.user.id;
        sendProjects(incoming);
        void persistSnapshot(incoming);
      }
      if (event.data.type === "projects-changed" && session && cloudReady && cloudLoadedRef.current) {
        void persistSnapshot(incoming);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [session, cloudReady]);

  useEffect(() => {
    const handleResize = () => {
      const next = clampPosition(positionRef.current);
      positionRef.current = next;
      setPosition(next);
      localStorage.setItem(positionKey, JSON.stringify(next));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [positionKey]);

  const prepareFrame = () => {
    const childDocument = frameRef.current?.contentDocument;
    if (!childDocument) return;
    const style = childDocument.createElement("style");
    style.textContent = frameOverrides;
    childDocument.head.append(style);

    let dragging = false;
    let moved = false;
    let startScreenX = 0;
    let startScreenY = 0;
    let startPosition = positionRef.current;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest(".uiverse-folder") || target.closest("button, input, .plan-card")) return;
      dragging = true;
      moved = false;
      startScreenX = event.screenX;
      startScreenY = event.screenY;
      startPosition = positionRef.current;
      (event.target as Element).setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const deltaX = event.screenX - startScreenX;
      const deltaY = event.screenY - startScreenY;
      if (!moved && Math.hypot(deltaX, deltaY) < 5) return;
      moved = true;
      event.preventDefault();
      const next = clampPosition({ left: startPosition.left + deltaX, top: startPosition.top + deltaY });
      positionRef.current = next;
      setPosition(next);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      event.preventDefault();
      localStorage.setItem(positionKey, JSON.stringify(positionRef.current));
      childDocument.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
      }, { capture: true, once: true });
    };
    childDocument.addEventListener("pointerdown", onPointerDown);
    childDocument.addEventListener("pointermove", onPointerMove, { passive: false });
    childDocument.addEventListener("pointerup", onPointerUp);
    childDocument.addEventListener("pointercancel", onPointerUp);
  };

  return (
    <div className="long-term-plans-overlay" style={{ left: position.left, top: position.top }}>
      <iframe
        ref={frameRef}
        className="long-term-plans-frame"
        src="/long-term-plans/index.html"
        title="Long-term Plans"
        onLoad={prepareFrame}
      />
    </div>
  );
}
