import { loadLongTermLocal, persistLongTermLocal, PLAN_KEY } from "./utils/longTermLocal";
// Demo-only fixtures. Production data and credentials are never imported.
import { createWeekPlan, createTask, getRelativeWeekStart } from "./utils/storage";
import { startOfWeek, toDateKey } from "./utils/date";
import type { MoodRecord } from "./utils/mood";
if (!localStorage.getItem("planrecord-demo-seeded-v1")) {
  const now = new Date();
  const start = toDateKey(startOfWeek(now));
  const week = createWeekPlan(start);
  week.days[0].tasks = [{ ...createTask("阅读一章（演示）", "study", week.days[0].date), completed: true }];
  week.days[1].tasks = Array.from({ length: 9 }, (_, index) => createTask(`待办 ${index + 1}（演示）`, "other", week.days[1].date));
  const previous = createWeekPlan(getRelativeWeekStart(start, -1), true);
  localStorage.setItem("plan-and-record-data-v1", JSON.stringify({ [start]: week, [previous.weekStartDate]: previous }));
  const records: Record<string, MoodRecord> = {};
  for (const offset of [0, -1]) {
    for (const day of [1, 3, 5, 8, 12]) {
      const date = toDateKey(new Date(now.getFullYear(), now.getMonth() + offset, day));
      records[date] = { mood: offset === 0 ? (day % 2 ? 3 : 4) : 5, entry: "用于本地预览的示例心情记录", tags: [] };
    }
  }
  localStorage.setItem("mood-records-v1", JSON.stringify(records));
  localStorage.setItem("plan-record-profile-name", "林溪");
  localStorage.setItem("planrecord-demo-seeded-v1", "1");
}

if (!localStorage.getItem("dark-demo-theme-initialized")) { localStorage.setItem("plan-record-theme", "dark"); localStorage.setItem("dark-demo-theme-initialized", "1"); }

if (!localStorage.getItem("dark-demo-travel-seeded")) {
 localStorage.setItem("travel-routes-v1", JSON.stringify([
 {id:"demo-route-1",from:"beijing",to:"tokyo",date:"2026-08-10",endDate:"2026-08-15",color:"#3b82f6"},
 {id:"demo-route-2",from:"tokyo",to:"singapore",date:"2026-09-01",endDate:"2026-09-05",color:"#10b981"}
 ]));
 localStorage.setItem("dark-demo-travel-seeded","1");
}

// Seed once before the iframe loads, so both long-term views share the same examples.
if (!localStorage.getItem(PLAN_KEY)) {
 const sample = loadLongTermLocal();
 sample.plans = sample.plans.slice(0, 3);
 persistLongTermLocal(sample);
}
