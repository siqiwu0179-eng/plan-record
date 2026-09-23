import { supabase } from "../lib/supabase";
import { blankDetails, type Compass, type PlanState } from "./longTermLocal";
export type Workspace = PlanState & { compass: Compass; versions: Record<string, string>; compassVersion: string | null };
export const emptyWorkspace = (): Workspace => ({ plans: [], details: {}, compass: { vision: "", creed: "", fiveYears: "" }, versions: {}, compassVersion: null });
const client = () => { if (!supabase) throw new Error("Supabase 尚未配置"); return supabase; };
export async function loadLongTermWorkspace(userId: string): Promise<Workspace> {
  const [plans, compass] = await Promise.all([
    client().from("long_term_plans").select("id,title,color,tasks,description,status,details,sort_order,updated_at").eq("user_id", userId).is("deleted_at", null).order("sort_order").order("created_at"),
    client().from("long_term_compass").select("vision,creed,five_years,updated_at").eq("user_id", userId).maybeSingle(),
  ]);
  if (plans.error) throw plans.error;
  if (compass.error) throw compass.error;
  const result = emptyWorkspace();
  for (const row of plans.data ?? []) {
    result.plans.push({ id: row.id, name: row.title, color: row.color, tasks: row.tasks });
    result.details[row.id] = { ...blankDetails(), ...row.details, goal: row.description, paused: row.details?.paused ?? row.status === "archived" };
    result.versions[row.id] = row.updated_at;
  }
  if (compass.data) {
    result.compass = { vision: compass.data.vision, creed: compass.data.creed, fiveYears: compass.data.five_years };
    result.compassVersion = compass.data.updated_at;
  }
  return result;
}
export function planChanges(before: Workspace, next: PlanState) {
  const changes: { id: string; expected: string | null; patch: Record<string, unknown> }[] = [];
  next.plans.forEach((plan, index) => {
    const oldIndex = before.plans.findIndex(item => item.id === plan.id);
    const old = before.plans[oldIndex];
    const details = next.details[plan.id] ?? blankDetails();
    const oldDetails = before.details[plan.id];
    const patch: Record<string, unknown> = {};
    if (!old || old.name !== plan.name) patch.title = plan.name;
    if (!old || old.color !== plan.color) patch.color = plan.color;
    if (!old || JSON.stringify(old.tasks) !== JSON.stringify(plan.tasks)) patch.tasks = plan.tasks;
    if (!old || oldIndex !== index) patch.sort_order = index;
    if (!old || oldDetails?.goal !== details.goal) patch.description = details.goal;
    if (!old || JSON.stringify(oldDetails) !== JSON.stringify(details)) {
      const { goal: _goal, ...rest } = details;
      patch.details = rest;
    }
    if (Object.keys(patch).length) changes.push({ id: plan.id, expected: before.versions[plan.id] ?? null, patch });
  });
  before.plans.filter(plan => !next.plans.some(item => item.id === plan.id)).forEach(plan => changes.push({ id: plan.id, expected: before.versions[plan.id], patch: { deleted: true } }));
  return changes;
}
export async function saveLongTermWorkspace(before: Workspace, next: PlanState, expectedUserId?: string): Promise<Workspace> {
  // A detached queue may outlive a page or account switch. Never send it as another user.
  if (expectedUserId) {
    const { data, error } = await client().auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== expectedUserId) throw new Error("账户已切换，请重新登录后重试。");
  }
  const changes = planChanges(before, next);
  if (!changes.length) return before;
  const { data, error } = await client().rpc("save_long_term_workspace_v2", { p_changes: changes });
  if (error) throw error;
  return { ...before, ...next, versions: { ...before.versions, ...data } };
}
export async function saveLongTermCompass(before: Workspace, next: Compass): Promise<Workspace> {
  const { data, error } = await client().rpc("save_long_term_compass_v2", { p_value: next, p_expected: before.compassVersion });
  if (error) throw error;
  return { ...before, compass: next, compassVersion: data };
}
export const saveErrorText = (error: unknown) => {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
  return message.includes("conflict") ? "另一窗口已修改此内容。本次未保存，请刷新后重新编辑。" : `云端保存失败，改动未保存，请重试。${message}`;
};
