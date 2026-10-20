import { CATEGORIES } from "../constants";
import type { Category, DayPlan, Task, WeekPlan } from "../types";
import { addDays, getWeekDateKeys, parseDateKey, startOfWeek, toDateKey } from "./date";

const STORAGE_KEY = "plan-and-record-data-v1";

type StoredPlans = Record<string, WeekPlan>;

const sampleTasks: Record<Category, string[]> = {
  study: ["阅读《原则》30页", "学习 React 基础", "刷算法题 3 道", "英语单词 50 个"],
  exercise: ["晨跑 5km", "力量训练 40 分钟", "拉伸 15 分钟"],
  diet: ["早餐：燕麦 + 鸡蛋", "午餐：牛肉 + 蔬菜", "晚餐：清淡饮食", "多喝水 2000ml"],
  other: ["整理房间", "复盘今日计划", "阅读 20 分钟"],
};

const makeId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readPlans = (): StoredPlans => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredPlans;
  } catch {
    return {};
  }
};

export const savePlans = (plans: StoredPlans): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
};

export const loadPlans = (): StoredPlans => {
  const plans = readPlans();
  if (Object.keys(plans).length > 0) return plans;

  const currentWeekStart = toDateKey(startOfWeek(new Date()));
  const initialPlans = { [currentWeekStart]: createWeekPlan(currentWeekStart) };
  savePlans(initialPlans);
  return initialPlans;
};

export const createWeekPlan = (weekStartDate: string, withSampleData = false): WeekPlan => {
  const dateKeys = getWeekDateKeys(weekStartDate);
  const weekEndDate = dateKeys[6];

  const days: DayPlan[] = dateKeys.map((date) => ({
    date,
    tasks: withSampleData ? createSampleTasksForDate(date) : [],
  }));

  return {
    weekStartDate,
    weekEndDate,
    days,
  };
};

const createSampleTasksForDate = (date: string): Task[] => {
  const dateIndex = Math.round(
    (parseDateKey(date).getTime() - startOfWeek(parseDateKey(date)).getTime()) /
      (24 * 60 * 60 * 1000),
  );

  return CATEGORIES.flatMap((category) => {
    const titles = sampleTasks[category];
    const visibleCount = Math.max(2, Math.min(titles.length, titles.length - (dateIndex % 2)));
    return titles.slice(0, visibleCount).map((title, taskIndex) => {
      const now = new Date().toISOString();
      const completed = (taskIndex + dateIndex) % 4 !== 2;
      return {
        id: makeId(),
        title,
        category,
        date,
        completed,
        createdAt: now,
        updatedAt: now,
      };
    });
  });
};

export const ensureWeekPlan = (plans: StoredPlans, weekStartDate: string): StoredPlans => {
  if (plans[weekStartDate]) return plans;
  return {
    ...plans,
    [weekStartDate]: createWeekPlan(weekStartDate),
  };
};

export const getRelativeWeekStart = (weekStartDate: string, offsetWeeks: number): string => {
  return toDateKey(addDays(parseDateKey(weekStartDate), offsetWeeks * 7));
};

export const createTask = (title: string, category: Category, date: string): Task => {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    title,
    category,
    date,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
};
