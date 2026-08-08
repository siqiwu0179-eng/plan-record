import { BarChart3, CalendarDays, CheckCircle2, ListChecks, TrendingUp } from "lucide-react";
import { WEEKDAY_LABELS } from "../constants";
import type { WeekPlan } from "../types";
import { getWeekStats } from "../utils/stats";

type WeeklySummaryCardProps = {
  week: WeekPlan;
};

export function WeeklySummaryCard({ week }: WeeklySummaryCardProps) {
  const stats = getWeekStats(week);
  const highestDay = `${WEEKDAY_LABELS[stats.highestIndex]} ${stats.highestRate}%`;
  const items = [
    { label: "已完成任务", value: stats.completedTasks, icon: CheckCircle2 },
    { label: "总任务数", value: stats.totalTasks, icon: ListChecks },
    { label: "最高完成日", value: highestDay, icon: TrendingUp },
    { label: "计划天数", value: `${stats.plannedDays} / 7`, icon: CalendarDays },
  ];

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <BarChart3 size={20} />
        </span>
        <h3 className="text-xl font-bold text-slate-950">本周总结</h3>
      </div>

      <div className="mt-6 rounded-lg bg-blue-50 p-5">
        <p className="text-sm font-semibold text-slate-500">本周平均完成度</p>
        <p className="mt-2 text-5xl font-bold tracking-normal text-blue-600">
          {stats.averageRate}%
        </p>
      </div>

      <div className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Icon className="shrink-0 text-blue-500" size={18} />
              <span className="truncate text-sm font-semibold text-slate-500">{label}</span>
            </div>
            <span className="text-right text-lg font-bold text-slate-950">{value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
