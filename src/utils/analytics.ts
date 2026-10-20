import { supabase } from "../lib/supabase";

export type AnalyticsModule = "auth" | "home" | "daily" | "longterm" | "completion" | "travel" | "mood";
export type DailySource = { goal_id: string; step_id: string };

// Best effort, bounded, account-scoped. Never await telemetry from business/UI code.
// Each retry reuses its ID so a lost HTTP response cannot duplicate an event.
export function trackAnalytics(userId: string, event: "user_logged_in" | "page_viewed" | "longterm_step_added_to_daily", module: AnalyticsModule, objectId: string | null = null, properties: Record<string, string> = {}) {
  if (!supabase) return;
  const client = supabase;
  let id: string;
  try { id = crypto.randomUUID(); } catch { return; }
  void (async () => {
    for (const delay of [0, 1000, 4000]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        const { data, error } = await client.auth.getSession();
        if (error || data.session?.user.id !== userId) return;
        const result = await client.rpc("analytics_track", { p_id: id, p_event: event, p_module: module, p_object: objectId, p_properties: properties })
          // Pin the checked session so a concurrent account switch cannot reattribute it.
          .setHeader("Authorization", `Bearer ${data.session.access_token}`)
          .abortSignal(AbortSignal.timeout(5000));
        if (!result.error) return;
      } catch { /* Telemetry must not affect product saves. */ }
    }
    console.warn("Analytics event was not delivered", event);
  })().catch(() => undefined);
}
