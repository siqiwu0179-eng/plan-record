import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { LongTermPlan, LongTermPlanStep, Task, WeekPlan } from "../types";
import { startOfWeek, toDateKey } from "./date";
import type { MoodRecord } from "./mood";
import type { TravelRoute } from "./travel";

export type CloudData = {
  profileName: string;
  avatarPath: string | null;
  motto: string;
  theme: "light" | "dark";
  plans: string;
  moods: string;
  travelRoutes: string;
};

type PlanTaskRow = {
  id: string;
  task_date: string;
  category: Task["category"];
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type CompletionRow = { task_id: string; completed: boolean; updated_at: string };

const keys = {
  profileName: "plan-record-profile-name",
  motto: "plan-record-home-motto",
  theme: "plan-record-theme",
  plans: "plan-and-record-data-v1",
  moods: "mood-records-v1",
  travelRoutes: "travel-routes-v1",
} as const;

const OUTBOX_KEY = "plan-record-cloud-outbox-v1";
type OutboxMutation = {
  id: string;
  userId: string;
  label: string;
  rpcName: string;
  args: Record<string, unknown>;
};

let activeUserId: string | null = null;

const readOutbox = (): OutboxMutation[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]") as OutboxMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOutbox = (mutations: OutboxMutation[]) =>
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(mutations));

const readLocalData = (): CloudData => ({
  profileName: localStorage.getItem(keys.profileName) || "林溪",
  avatarPath: null,
  motto: localStorage.getItem(keys.motto) || "把今天过好，就是最可靠的进步。",
  theme: localStorage.getItem(keys.theme) === "dark" ? "dark" : "light",
  plans: localStorage.getItem(keys.plans) || "{}",
  moods: localStorage.getItem(keys.moods) || "{}",
  travelRoutes: localStorage.getItem(keys.travelRoutes) || "[]",
});

export const getLocalCloudData = readLocalData;

export const createInitialCloudData = (session: Session): CloudData => ({
  profileName: String(session.user.user_metadata?.full_name ?? "").trim() || "林溪",
  avatarPath: null,
  motto: "把今天过好，就是最可靠的进步。",
  theme: "light",
  plans: "{}",
  moods: "{}",
  travelRoutes: "[]",
});

export const clearLocalUserData = () => {
  activeUserId = null;
  localStorage.removeItem(keys.profileName);
  localStorage.removeItem(keys.motto);
  localStorage.setItem(keys.plans, "{}");
  localStorage.setItem(keys.moods, "{}");
  localStorage.setItem(keys.travelRoutes, "[]");
};

export const applyCloudData = (data: Partial<CloudData>) => {
  if (data.profileName !== undefined) localStorage.setItem(keys.profileName, data.profileName);
  if (data.motto !== undefined) localStorage.setItem(keys.motto, data.motto);
  if (data.theme !== undefined) localStorage.setItem(keys.theme, data.theme);
  if (data.plans !== undefined) localStorage.setItem(keys.plans, data.plans);
  if (data.moods !== undefined) localStorage.setItem(keys.moods, data.moods);
  if (data.travelRoutes !== undefined) localStorage.setItem(keys.travelRoutes, data.travelRoutes);
};

const buildPlans = (tasks: PlanTaskRow[], completions: CompletionRow[]) => {
  const completionByTask = new Map(completions.map((item) => [item.task_id, item]));
  const orderByTask = new Map(tasks.map((item) => [item.id, item.sort_order]));
  const plans: Record<string, WeekPlan> = {};

  for (const row of tasks) {
    const weekStartDate = toDateKey(startOfWeek(new Date(`${row.task_date}T12:00:00`)));
    const week = plans[weekStartDate] ?? {
      weekStartDate,
      weekEndDate: toDateKey(new Date(new Date(`${weekStartDate}T12:00:00`).getTime() + 6 * 86400000)),
      days: Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${weekStartDate}T12:00:00`);
        date.setDate(date.getDate() + index);
        return { date: toDateKey(date), tasks: [] };
      }),
    };
    const completion = completionByTask.get(row.id);
    const task: Task = {
      id: row.id,
      title: row.title,
      category: row.category,
      date: row.task_date,
      completed: completion?.completed ?? false,
      createdAt: row.created_at,
      updatedAt: completion && completion.updated_at > row.updated_at ? completion.updated_at : row.updated_at,
    };
    week.days.find((day) => day.date === row.task_date)?.tasks.push(task);
    plans[weekStartDate] = week;
  }

  for (const week of Object.values(plans)) {
    for (const day of week.days) {
      day.tasks.sort((a, b) =>
        (orderByTask.get(a.id) ?? 0) - (orderByTask.get(b.id) ?? 0) || a.createdAt.localeCompare(b.createdAt),
      );
    }
  }
  return plans;
};

export const loadCloudData = async (session: Session): Promise<CloudData | null> => {
  if (!supabase) return null;
  activeUserId = session.user.id;
  await replayPendingCloudMutations(session);
  const [profileResult, preferencesResult, taskResult, completionResult, moodResult, travelResult] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_path").eq("user_id", session.user.id).maybeSingle(),
    supabase.from("user_preferences").select("motto, theme").eq("user_id", session.user.id).maybeSingle(),
    supabase.from("plan_tasks").select("id, task_date, category, title, sort_order, created_at, updated_at").eq("user_id", session.user.id).is("deleted_at", null),
    supabase.from("task_completions").select("task_id, completed, updated_at").eq("user_id", session.user.id),
    supabase.from("mood_records").select("record_date, mood, entry, tags").eq("user_id", session.user.id).is("deleted_at", null),
    supabase.from("travel_records").select("id, from_city, to_city, start_date, end_date, color, sort_order").eq("user_id", session.user.id).is("deleted_at", null).order("sort_order"),
  ]);

  for (const result of [profileResult, preferencesResult, taskResult, completionResult, moodResult, travelResult]) {
    if (result.error) throw result.error;
  }
  if (!preferencesResult.data) return null;

  const moods = Object.fromEntries(
    (moodResult.data ?? []).map((row) => [row.record_date, { mood: row.mood, entry: row.entry, tags: row.tags ?? [] }]),
  );
  const travelRoutes = (travelResult.data ?? []).map((row) => ({
    id: row.id,
    from: row.from_city,
    to: row.to_city,
    date: row.start_date,
    endDate: row.end_date,
    color: row.color,
  }));

  return {
    profileName: profileResult.data?.display_name || "林溪",
    avatarPath: profileResult.data?.avatar_path ?? null,
    motto: preferencesResult.data.motto,
    theme: preferencesResult.data.theme === "dark" ? "dark" : "light",
    plans: JSON.stringify(buildPlans((taskResult.data ?? []) as PlanTaskRow[], (completionResult.data ?? []) as CompletionRow[])),
    moods: JSON.stringify(moods),
    travelRoutes: JSON.stringify(travelRoutes),
  };
};

let mutationTail: Promise<void> = Promise.resolve();

const retry = async (operation: () => Promise<void>) => {
  const delays = [0, 350, 1200];
  let lastError: unknown;
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const enqueueMutation = (label: string, operation: () => Promise<void>) => {
  const task = mutationTail.then(() => retry(operation));
  mutationTail = task.catch((error) => {
    console.error(`Unable to persist ${label}`, error);
    window.dispatchEvent(new CustomEvent("plan-record-save-error", { detail: { label } }));
  });
  return mutationTail;
};

const getCurrentSession = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

const rpc = async (name: string, args: Record<string, unknown>) => {
  if (!supabase) return;
  const { error } = await supabase.rpc(name, args);
  if (error) throw error;
};

const removeOutboxMutation = (id: string) =>
  writeOutbox(readOutbox().filter((mutation) => mutation.id !== id));

const scheduleRpcMutation = (label: string, rpcName: string, args: Record<string, unknown>) => {
  if (!activeUserId) return Promise.resolve();
  const mutation: OutboxMutation = {
    id: crypto.randomUUID(),
    userId: activeUserId,
    label,
    rpcName,
    args,
  };
  writeOutbox([...readOutbox(), mutation]);
  return enqueueMutation(label, async () => {
    const session = await getCurrentSession();
    if (!session || session.user.id !== mutation.userId) return;
    await rpc(mutation.rpcName, mutation.args);
    removeOutboxMutation(mutation.id);
  });
};

async function replayPendingCloudMutations(session: Session) {
  for (const mutation of readOutbox().filter((item) => item.userId === session.user.id)) {
    await retry(() => rpc(mutation.rpcName, mutation.args));
    removeOutboxMutation(mutation.id);
  }
}

window.addEventListener("online", () => {
  void enqueueMutation("pending changes", async () => {
    const session = await getCurrentSession();
    if (session) await replayPendingCloudMutations(session);
  });
});

export const flushCloudMutations = () => mutationTail;

export const saveUserPreferences = (session: Session, data = readLocalData()) => {
  const updatedAt = new Date().toISOString();
  const profileSave = enqueueMutation("profile", async () => {
    if (!supabase) return;
    const profileResult = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      phone: session.user.user_metadata?.phone ?? session.user.phone ?? null,
      display_name: data.profileName,
      updated_at: updatedAt,
    });
    if (profileResult.error) throw profileResult.error;
  });
  const preferencesSave = scheduleRpcMutation("preferences", "save_user_preferences", {
    p_motto: data.motto,
    p_theme: data.theme,
    p_updated_at: updatedAt,
  });
  return Promise.all([profileSave, preferencesSave]).then(() => undefined);
};

export const saveInitialCloudData = (session: Session, data: CloudData) => saveUserPreferences(session, data);

export const savePlanTask = (task: Task, sortOrder: number) =>
  scheduleRpcMutation("daily plan", "save_plan_task", {
      p_id: task.id,
      p_task_date: task.date,
      p_category: task.category,
      p_title: task.title,
      p_sort_order: sortOrder,
      p_completed: task.completed,
      p_created_at: task.createdAt,
      p_updated_at: task.updatedAt,
  });

export const removePlanTask = (taskId: string, updatedAt = new Date().toISOString()) =>
  scheduleRpcMutation("daily plan deletion", "delete_plan_task", { p_id: taskId, p_updated_at: updatedAt });

export const saveMoodRecord = (recordDate: string, record: MoodRecord) =>
  scheduleRpcMutation("mood record", "save_mood_record", {
    p_record_date: recordDate,
    p_mood: record.mood,
    p_entry: record.entry,
    p_tags: record.tags,
    p_updated_at: new Date().toISOString(),
  });

export const removeMoodRecord = (recordDate: string) =>
  scheduleRpcMutation("mood record deletion", "delete_mood_record", { p_record_date: recordDate, p_updated_at: new Date().toISOString() });

export const saveTravelRoute = (route: TravelRoute, sortOrder: number) =>
  scheduleRpcMutation("travel record", "save_travel_record", {
      p_id: route.id,
      p_from_city: route.from,
      p_to_city: route.to,
      p_start_date: route.date,
      p_end_date: route.endDate ?? route.date,
      p_color: route.color,
      p_sort_order: sortOrder,
      p_updated_at: new Date().toISOString(),
  });

export const removeTravelRoute = (routeId: string) =>
  scheduleRpcMutation("travel record deletion", "delete_travel_record", { p_id: routeId, p_updated_at: new Date().toISOString() });

const normalizeLongTermSteps = (value: unknown): LongTermPlanStep[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<LongTermPlanStep>;
    const id = String(candidate.id ?? "").trim();
    const title = String(candidate.title ?? "").trim();
    if (!id || !title) return [];
    return [{ id, title, done: Boolean(candidate.done) }];
  });
};

export const loadLongTermPlans = async (session: Session): Promise<LongTermPlan[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("long_term_plans")
    .select("id, title, color, tasks, sort_order")
    .eq("user_id", session.user.id)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.title,
    color: row.color,
    tasks: normalizeLongTermSteps(row.tasks),
  }));
};

export const saveLongTermPlan = (plan: LongTermPlan, sortOrder: number) =>
  scheduleRpcMutation("long-term plan", "save_long_term_plan", {
    p_id: plan.id,
    p_title: plan.name,
    p_color: plan.color,
    p_tasks: plan.tasks,
    p_sort_order: sortOrder,
    p_updated_at: new Date().toISOString(),
  });

export const removeLongTermPlan = (planId: string) =>
  scheduleRpcMutation("long-term plan deletion", "delete_long_term_plan", {
    p_id: planId,
    p_updated_at: new Date().toISOString(),
  });

export const loadAvatarObjectUrl = async (avatarPath: string): Promise<string> => {
  if (!supabase) throw new Error("Supabase 尚未配置");
  const { data, error } = await supabase.storage.from("avatars").download(avatarPath);
  if (error) throw error;
  return URL.createObjectURL(data);
};

export const uploadProfileAvatar = async (session: Session, file: File): Promise<string> => {
  if (!supabase) throw new Error("Supabase 尚未配置");
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("仅支持 JPG、PNG 或 WebP 图片");
  if (file.size > 2 * 1024 * 1024) throw new Error("头像图片不能超过 2MB");

  const avatarPath = `${session.user.id}/avatar`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(avatarPath, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (uploadError) throw uploadError;
  const { error: profileError } = await supabase.from("profiles").update({ avatar_path: avatarPath, updated_at: new Date().toISOString() }).eq("user_id", session.user.id);
  if (profileError) throw profileError;
  return avatarPath;
};

export const notifyDataChanged = () => window.dispatchEvent(new Event("plan-record-data-changed"));
