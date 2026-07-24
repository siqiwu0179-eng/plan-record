import type { DayPlan, Task, WeekPlan } from "../types";

export const getCompletionRate = (tasks: Task[]): number => {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => task.completed).length;
  return Math.round((completed / tasks.length) * 100);
};

export const getDayRate = (day: DayPlan): number => getCompletionRate(day.tasks);

export const countCompleted = (tasks: Task[]): number =>
  tasks.filter((task) => task.completed).length;

export const getWeekStats = (week: WeekPlan) => {
  const dayRates = week.days.map((day) => getDayRate(day));
  const totalTasks = week.days.reduce((sum, day) => sum + day.tasks.length, 0);
  const completedTasks = week.days.reduce((sum, day) => sum + countCompleted(day.tasks), 0);
  const averageRate = Math.round(dayRates.reduce((sum, rate) => sum + rate, 0) / 7);
  const highestRate = Math.max(...dayRates);
  const highestIndex = dayRates.findIndex((rate) => rate === highestRate);
  const plannedDays = week.days.filter((day) => day.tasks.length > 0).length;

  return {
    dayRates,
    totalTasks,
    completedTasks,
    averageRate,
    highestRate,
    highestIndex,
    plannedDays,
  };
};
