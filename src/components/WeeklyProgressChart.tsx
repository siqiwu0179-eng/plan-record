import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WEEKDAY_LABELS } from "../constants";
import type { WeekPlan } from "../types";
import { formatSlashDate } from "../utils/date";
import { getDayRate } from "../utils/stats";

type WeeklyProgressChartProps = {
  week: WeekPlan;
};

export function WeeklyProgressChart({ week }: WeeklyProgressChartProps) {
  const data = week.days.map((day, index) => ({
    name: WEEKDAY_LABELS[index],
    date: formatSlashDate(day.date),
    rate: getDayRate(day),
  }));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-950">本周完成度趋势</h3>
          <p className="mt-1 text-sm text-slate-500">每日完成率实时更新</p>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 20, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#475569", fontSize: 13, fontWeight: 600 }}
              tickFormatter={(value, index) => `${value} ${data[index]?.date ?? ""}`}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value) => `${value}%`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, "完成率"]}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                return item ? `${item.name} · ${item.date}` : "";
              }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                boxShadow: "0 12px 30px rgba(15, 23, 42, 0.1)",
              }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#2563eb"
              strokeWidth={3}
              dot={{ r: 5, strokeWidth: 3, stroke: "#2563eb", fill: "#ffffff" }}
              activeDot={{ r: 7, strokeWidth: 3, stroke: "#2563eb", fill: "#ffffff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
