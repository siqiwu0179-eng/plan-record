import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type CloudData = {
  profileName: string;
  avatarPath: string | null;
  motto: string;
  theme: "light" | "dark";
  plans: string;
  moods: string;
  travelRoutes: string;
};

const keys = {
  profileName: "plan-record-profile-name",
  motto: "plan-record-home-motto",
  theme: "plan-record-theme",
  plans: "plan-and-record-data-v1",
  moods: "mood-records-v1",
  travelRoutes: "travel-routes-v1",
} as const;

const PENDING_MIGRATION_KEY = "plan-record-pending-cloud-migration-v1";
const COMPLETED_MIGRATION_KEY = "plan-record-completed-cloud-migration-v1";
const DEFAULT_PROFILE_NAME = "林溪";
const DEFAULT_MOTTOS = new Set([
  "专注当下，记录成长，遇见更好的自己。",
  "把今天过好，就是最可靠的进步。",
]);

const hasStoredEntries = (raw: string | null, kind: "object" | "array") => {
  if (!raw) return false;
  try {
    const value = JSON.parse(raw);
    return kind === "array"
      ? Array.isArray(value) && value.length > 0
      : value && typeof value === "object" && Object.keys(value).length > 0;
  } catch {
    return false;
  }
};

const hasStoredTasks = (raw: string | null) => {
  if (!raw) return false;
  try {
    const weeks = Object.values(JSON.parse(raw) as Record<string, { days?: Array<{ tasks?: unknown[] }> }>);
    return weeks.some((week) => week.days?.some((day) => (day.tasks?.length ?? 0) > 0));
  } catch {
    return false;
  }
};

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

export const capturePendingMigration = (): CloudData | null => {
  const existing = localStorage.getItem(PENDING_MIGRATION_KEY);
  if (existing) {
    if (localStorage.getItem(COMPLETED_MIGRATION_KEY) === "true") return null;
    try {
      const parsed = JSON.parse(existing) as Partial<CloudData>;
      return {
        profileName: parsed.profileName || "林溪",
        avatarPath: null,
        motto: parsed.motto || "把今天过好，就是最可靠的进步。",
        theme: parsed.theme === "dark" ? "dark" : "light",
        plans: parsed.plans || "{}",
        moods: parsed.moods || "{}",
        travelRoutes: parsed.travelRoutes || "[]",
      };
    } catch {
      return null;
    }
  }

  const storedName = localStorage.getItem(keys.profileName);
  const storedMotto = localStorage.getItem(keys.motto);
  const hasLegacyData = Boolean(
    (storedName && storedName !== DEFAULT_PROFILE_NAME)
    || (storedMotto && !DEFAULT_MOTTOS.has(storedMotto))
    || hasStoredTasks(localStorage.getItem(keys.plans))
    || hasStoredEntries(localStorage.getItem(keys.moods), "object")
    || hasStoredEntries(localStorage.getItem(keys.travelRoutes), "array"),
  );
  if (!hasLegacyData) return null;

  const snapshot = readLocalData();
  localStorage.setItem(PENDING_MIGRATION_KEY, JSON.stringify(snapshot));
  return snapshot;
};

export const getPendingMigration = (): CloudData | null => {
  if (localStorage.getItem(COMPLETED_MIGRATION_KEY) === "true") return null;
  const raw = localStorage.getItem(PENDING_MIGRATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CloudData>;
    return {
      profileName: parsed.profileName || "林溪",
      avatarPath: null,
      motto: parsed.motto || "把今天过好，就是最可靠的进步。",
      theme: parsed.theme === "dark" ? "dark" : "light",
      plans: parsed.plans || "{}",
      moods: parsed.moods || "{}",
      travelRoutes: parsed.travelRoutes || "[]",
    };
  } catch {
    return null;
  }
};

export const completePendingMigration = () => {
  // Keep the original migration snapshot as a local recovery copy.
  // The completion marker prevents it from being imported more than once.
  localStorage.setItem(COMPLETED_MIGRATION_KEY, "true");
};

export const clearLocalUserData = () => {
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

export const loadCloudData = async (session: Session): Promise<CloudData | null> => {
  if (!supabase) return null;
  const [userDataResult, profileResult] = await Promise.all([
    supabase.from("user_data").select("*").eq("user_id", session.user.id).maybeSingle(),
    supabase.from("profiles").select("display_name, avatar_path").eq("user_id", session.user.id).maybeSingle(),
  ]);
  if (userDataResult.error) throw userDataResult.error;
  if (profileResult.error) throw profileResult.error;
  const data = userDataResult.data;
  if (!data) return null;
  return {
    profileName: profileResult.data?.display_name || data.profile_name,
    avatarPath: profileResult.data?.avatar_path ?? null,
    motto: data.motto,
    theme: data.theme === "dark" ? "dark" : "light",
    plans: JSON.stringify(data.plans ?? {}),
    moods: JSON.stringify(data.moods ?? {}),
    travelRoutes: JSON.stringify(data.travel_routes ?? []),
  };
};

export const loadAvatarObjectUrl = async (avatarPath: string): Promise<string> => {
  if (!supabase) throw new Error("Supabase 尚未配置");
  const { data, error } = await supabase.storage.from("avatars").download(avatarPath);
  if (error) throw error;
  return URL.createObjectURL(data);
};

export const uploadProfileAvatar = async (session: Session, file: File): Promise<string> => {
  if (!supabase) throw new Error("Supabase 尚未配置");
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("仅支持 JPG、PNG 或 WebP 图片");
  }
  if (file.size > 2 * 1024 * 1024) throw new Error("头像图片不能超过 2MB");

  const avatarPath = `${session.user.id}/avatar`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(avatarPath, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploadError) throw uploadError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_path: avatarPath, updated_at: new Date().toISOString() })
    .eq("user_id", session.user.id);
  if (profileError) throw profileError;
  return avatarPath;
};

export const saveCloudData = async (session: Session, data = readLocalData()) => {
  if (!supabase) return;
  const plans = JSON.parse(data.plans || "{}");
  const moods = JSON.parse(data.moods || "{}");
  const travelRoutes = JSON.parse(data.travelRoutes || "[]");
  const weeks = Object.values(plans as Record<string, { days: Array<{ tasks: Array<{ completed: boolean }> }> }>);
  const tasks = weeks.reduce<Array<{ completed: boolean }>>(
    (allTasks, week) => allTasks.concat(week.days.flatMap((day) => day.tasks)),
    [],
  );
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const profileResult = await supabase.from("profiles").upsert({
    user_id: session.user.id,
    phone: session.user.user_metadata?.phone ?? session.user.phone ?? null,
    display_name: data.profileName,
    updated_at: new Date().toISOString(),
  });
  if (profileResult.error) throw profileResult.error;
  const { error } = await supabase.from("user_data").upsert({
    user_id: session.user.id,
    profile_name: data.profileName,
    motto: data.motto,
    theme: data.theme,
    plans,
    moods,
    travel_routes: travelRoutes,
    stats: { total_tasks: totalTasks, completed_tasks: completedTasks, mood_days: Object.keys(moods).length, travel_routes: travelRoutes.length },
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

export const notifyDataChanged = () => window.dispatchEvent(new Event("plan-record-data-changed"));
