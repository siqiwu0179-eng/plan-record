import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { formatWeekRange } from "../utils/date";

type WeekNavigatorProps = {
  weekStartDate: string;
  weekEndDate: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
};

export function WeekNavigator({
  weekStartDate,
  weekEndDate,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
}: WeekNavigatorProps) {
  return (
    <section className="flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">当前周期</p>
        <h2 className="mt-1 text-2xl font-bold tracking-normal text-slate-950">
          {formatWeekRange(weekStartDate, weekEndDate)}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
          type="button"
          onClick={onPreviousWeek}
          aria-label="上一周"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
          type="button"
          onClick={onNextWeek}
          aria-label="下一周"
        >
          <ChevronRight size={22} />
        </button>
        <button
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-semibold text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
          type="button"
          onClick={onCurrentWeek}
        >
          <CalendarDays size={18} />
          返回本周
        </button>
      </div>
    </section>
  );
}
