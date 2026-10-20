import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { formatWeekRange } from "../utils/date";

type WeekNavigatorProps = {
  weekStartDate: string;
  weekEndDate: string;
  onDateSelect?: (date: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
};

export function WeekNavigator({
  weekStartDate,
  weekEndDate,
  onDateSelect,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
}: WeekNavigatorProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };
  return (
    <section className="flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">当前周期</p>
        <h2 className="mt-1 text-2xl font-bold tracking-normal text-slate-950">
          {formatWeekRange(weekStartDate, weekEndDate)}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {onDateSelect && (
          <button
            type="button"
            aria-label="选择日期"
            title="选择日期"
            onClick={openDatePicker}
            className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
          >
            <CalendarDays size={20} />
            <input
              ref={dateInputRef}
              type="date"
              value={weekStartDate}
              onChange={(event) => {
                if (event.target.value) onDateSelect(event.target.value);
              }}
              className="pointer-events-none absolute h-px w-px opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            />
          </button>
        )}
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
