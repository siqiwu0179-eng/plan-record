import { CalendarDays } from "lucide-react";
import { useRef } from "react";
import { CATEGORIES } from "../constants";
import type { Category, DayPlan } from "../types";
import { formatMonthDay, getWeekdayLabel } from "../utils/date";
import { getDayRate } from "../utils/stats";
import { CategoryCard } from "./CategoryCard";
import { ProgressRing } from "./ProgressRing";

type TaskBoardProps = {
  day: DayPlan;
  onDateSelect: (date: string) => void;
  onAddTask: (category: Category, title: string) => void;
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
};

export function TaskBoard({
  day,
  onDateSelect,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
}: TaskBoardProps) {
  const dayRate = getDayRate(day);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <section className="mt-8">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-normal text-slate-950">
            {formatMonthDay(day.date)} · {getWeekdayLabel(day.date)}
          </h2>
          <button
            type="button"
            onClick={openDatePicker}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 ring-1 ring-slate-200 transition hover:bg-blue-50 hover:text-blue-600 hover:ring-blue-200"
            aria-label="选择日期"
          >
            <CalendarDays size={19} />
            <input
              ref={dateInputRef}
              type="date"
              value={day.date}
              onChange={(event) => {
                if (event.target.value) onDateSelect(event.target.value);
              }}
              className="pointer-events-none absolute h-px w-px opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-500">每日完成度</span>
          <span className="text-2xl font-bold text-green-600">{dayRate}%</span>
          <ProgressRing value={dayRate} color="#16a34a" size="sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((category) => (
          <CategoryCard
            key={category}
            category={category}
            tasks={day.tasks.filter((task) => task.category === category)}
            onAddTask={onAddTask}
            onToggleTask={onToggleTask}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
    </section>
  );
}
