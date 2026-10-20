import type { DayPlan } from "../types";
import { formatSlashDate, getWeekdayLabel } from "../utils/date";
import { getDayRate } from "../utils/stats";
import { ProgressRing } from "./ProgressRing";

type DayCardProps = {
  day: DayPlan;
  selected: boolean;
  onSelect: (date: string) => void;
};

export function DayCard({ day, selected, onSelect }: DayCardProps) {
  const rate = getDayRate(day);

  return (
    <button
      type="button"
      onClick={() => onSelect(day.date)}
      className={`min-w-[172px] rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${
        selected ? "border-blue-500 bg-blue-50/60 ring-4 ring-blue-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-base font-bold ${selected ? "text-blue-600" : "text-slate-900"}`}>
            {getWeekdayLabel(day.date)}
          </p>
          <p className="mt-1 text-sm text-slate-500">{formatSlashDate(day.date)}</p>
          <p className="mt-3 text-xl font-bold text-slate-950">{rate}%</p>
        </div>
        <ProgressRing value={rate} />
      </div>
    </button>
  );
}
