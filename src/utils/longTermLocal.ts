import type { LongTermPlan } from "../types";
export type Entry = { id: string; title: string; content: string };
export type PlanDetails = { goal: string; tone: string; paused: boolean; notes: Entry[]; resources: Entry[]; ideas: Entry[] };
export type PlanState = { plans: LongTermPlan[]; details: Record<string, PlanDetails> };
export type Compass = { vision: string; creed: string; fiveYears: string };
export const blankDetails = (): PlanDetails => ({ goal: "", tone: "blue", paused: false, notes: [], resources: [], ideas: [] });
export const rateOf = (plan: LongTermPlan) => plan.tasks.length ? Math.round(plan.tasks.filter(step => step.done).length / plan.tasks.length * 100) : 0;
export const statusOf = (plan: LongTermPlan, details?: PlanDetails) => details?.paused ? "已搁置" : plan.tasks.length > 0 && plan.tasks.every(step => step.done) ? "已完成" : "进行中";
export const safeUrl = (value: string) => {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
};
