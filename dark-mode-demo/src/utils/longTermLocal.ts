import type { LongTermPlan } from "../types";
export const PLAN_KEY = "plan-record-long-term-plans-demo-v1";
export const DETAIL_KEY = "planrecord-longterm-interactions-v1";
export type Entry = { id: string; title: string; content: string };
export type PlanDetails = { goal: string; tone: string; paused: boolean; notes: Entry[]; resources: Entry[]; ideas: Entry[] };
export type PlanState = { plans: LongTermPlan[]; details: Record<string, PlanDetails> };
export const blankDetails = (): PlanDetails => ({ goal: "", tone: "blue", paused: false, notes: [], resources: [], ideas: [] });
export const rateOf = (plan: LongTermPlan) => plan.tasks.length ? Math.round(plan.tasks.filter(step => step.done).length / plan.tasks.length * 100) : 0;
export const statusOf = (plan: LongTermPlan, details?: PlanDetails) => details?.paused ? "已搁置" : plan.tasks.length > 0 && plan.tasks.every(step => step.done) ? "已完成" : "进行中";
export const safeUrl = (value: string) => {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
};
export function loadLongTermLocal(): PlanState {
  const saved = localStorage.getItem(PLAN_KEY);
  const seed = [
    ["完成PhD申请", "顺利拿到理想院校的PhD offer", "blue"],
    ["日本旅行计划", "规划一次放松又充实的日本旅行", "green"],
    ["保持健康生活", "建立规律运动和饮食习惯", "purple"],
    ["提升专业技能", "完成 Python 基础课程学习", "amber"],
    ["澳洲长期发展规划", "明确毕业后在澳洲的职业发展方向", "leaf"],
  ];
  const labels = ["确定研究方向与目标院校", "联系潜在导师并沟通", "准备研究计划（RP）初稿", "完善研究计划并修改", "提交正式申请材料", "面试准备", "获得录取结果"];
  const plans: LongTermPlan[] = saved ? JSON.parse(saved) : seed.map(([name], index) => ({ id: `reference-plan-${index}`, name, color: ["#C7DCCF", "#D8D1E6", "#F6E8B8", "#FFD8B5", "#DDAAA1"][index], tasks: (index === 0 ? labels : ["确定目标与方向", "整理相关资料", "制定行动计划", "推进关键步骤", "总结与复盘"]).map((title, step) => ({ id: `reference-${index}-${step}`, title, done: step < (index === 0 ? 3 : index === 3 ? 5 : 1) })) }));
  const details: Record<string, PlanDetails> = JSON.parse(localStorage.getItem(DETAIL_KEY) || "{}");
  if (!Array.isArray(plans) || plans.some(plan => !plan.id || !Array.isArray(plan.tasks))) throw new Error("本地长期计划数据无法读取，请保留数据并重试。");
  if (!details || typeof details !== "object" || Array.isArray(details)) throw new Error("本地计划详情格式异常，未覆盖原数据。");
  const legacy = JSON.parse(localStorage.getItem("planrecord-longterm-details-v1") || "{}");
  plans.forEach((plan: LongTermPlan, index: number) => {
    if (!details[plan.id]) {
      const old = legacy?.[plan.id];
      const example = seed.find(([name]) => name === plan.name);
      details[plan.id] = { ...blankDetails(), goal: old?.goal ?? example?.[1] ?? "", tone: example?.[2] ?? ["blue", "green", "purple", "amber", "leaf"][index % 5], paused: old?.paused ?? (!saved && index === 4), notes: typeof old?.notes === "string" && old.notes ? [{ id: `legacy-note-${plan.id}`, title: "计划笔记", content: old.notes }] : [], resources: Array.isArray(old?.resources) ? old.resources.map((entry: { id: string; title: string; url: string }) => ({ id: entry.id, title: entry.title, content: entry.url })) : [], ideas: [] };
    }
    for (const key of ["notes", "resources", "ideas"] as const) {
      if (!Array.isArray(details[plan.id][key])) throw new Error("本地计划内容格式异常，未覆盖原数据。");
    }
  });
  return { plans, details };
}
export function persistLongTermLocal(next: PlanState) {
  const oldPlans = localStorage.getItem(PLAN_KEY), oldDetails = localStorage.getItem(DETAIL_KEY);
  try {
    localStorage.setItem(DETAIL_KEY, JSON.stringify(next.details));
    localStorage.setItem(PLAN_KEY, JSON.stringify(next.plans));
  } catch (error) {
    if (oldPlans !== null) localStorage.setItem(PLAN_KEY, oldPlans); else localStorage.removeItem(PLAN_KEY);
    if (oldDetails !== null) localStorage.setItem(DETAIL_KEY, oldDetails); else localStorage.removeItem(DETAIL_KEY);
    throw error;
  }
  window.dispatchEvent(new Event("longterm-demo-updated"));
}
