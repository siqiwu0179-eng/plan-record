import { supabase } from "../lib/supabase";

const VISITOR_KEY = "plan-record-visitor-id-v1";
const HEARTBEAT_SECONDS = 15;

const makeId = () => crypto.randomUUID();

const getVisitorId = () => {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const created = makeId();
  localStorage.setItem(VISITOR_KEY, created);
  return created;
};

const visitorId = getVisitorId();
const sessionId = makeId();
let currentUserId: string | null = null;
let heartbeatTimer: number | null = null;

type EventType = "session_start" | "page_view" | "heartbeat";

const sendEvent = async (
  eventType: EventType,
  options: { pageGroup?: "home" | "inner"; viewName?: string; activeSeconds?: number } = {},
) => {
  if (!supabase) return;
  // Supabase can restore its auth session before React has propagated the
  // session into currentUserId. Resolve the client session here so the first
  // events after a reload satisfy the authenticated RLS policy.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = currentUserId ?? session?.user.id ?? null;
  const { error } = await supabase.from("analytics_events").insert({
    visitor_id: visitorId,
    session_id: sessionId,
    user_id: userId,
    event_type: eventType,
    page_group: options.pageGroup ?? null,
    view_name: options.viewName ?? null,
    active_seconds: options.activeSeconds ?? 0,
  });
  if (error) console.warn("Analytics event was not saved", error.message);
};

export const setAnalyticsUserId = (userId: string | null) => {
  currentUserId = userId;
};

export const startAnalytics = () => {
  void sendEvent("session_start");
  heartbeatTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void sendEvent("heartbeat", { activeSeconds: HEARTBEAT_SECONDS });
    }
  }, HEARTBEAT_SECONDS * 1000);

  return () => {
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };
};

export const trackPageView = (viewName: string, pageGroup: "home" | "inner") => {
  void sendEvent("page_view", { pageGroup, viewName });
};
