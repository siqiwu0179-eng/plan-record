import { useEffect, useMemo, useState } from "react";
import { DayCard } from "./components/DayCard";
import { Header } from "./components/Header";
import { TaskBoard } from "./components/TaskBoard";
import { WeekNavigator } from "./components/WeekNavigator";
import { WeeklyProgressChart } from "./components/WeeklyProgressChart";
import { WeeklySummaryCard } from "./components/WeeklySummaryCard";
import type { Category, WeekPlan } from "./types";
import { parseDateKey, startOfWeek, toDateKey } from "./utils/date";
import { createTask, ensureWeekPlan, getRelativeWeekStart, loadPlans, savePlans } from "./utils/storage";

type StoredPlans = Record<string, WeekPlan>;

function App() {
  const initialWeekStart = toDateKey(startOfWeek(new Date()));
  const [plans, setPlans] = useState<StoredPlans>(() => loadPlans());
  const [activeWeekStart, setActiveWeekStart] = useState(initialWeekStart);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));

  useEffect(() => {
    setPlans((currentPlans) => {
      const nextPlans = ensureWeekPlan(currentPlans, activeWeekStart);
      if (nextPlans !== currentPlans) savePlans(nextPlans);
      return nextPlans;
    });
  }, [activeWeekStart]);

  const activeWeek = useMemo(() => {
    return plans[activeWeekStart] ?? ensureWeekPlan(plans, activeWeekStart)[activeWeekStart];
  }, [activeWeekStart, plans]);

  const selectedDay = useMemo(() => {
    return activeWeek.days.find((day) => day.date === selectedDate) ?? activeWeek.days[0];
  }, [activeWeek, selectedDate]);

  const updateWeek = (updater: (week: WeekPlan) => WeekPlan) => {
    setPlans((currentPlans) => {
      const currentWeek = currentPlans[activeWeekStart] ?? activeWeek;
      const updatedWeek = updater(currentWeek);
      const nextPlans = {
        ...currentPlans,
        [activeWeekStart]: updatedWeek,
      };
      savePlans(nextPlans);
      return nextPlans;
    });
  };

  const goToWeek = (weekStartDate: string) => {
    const nextPlans = ensureWeekPlan(plans, weekStartDate);
    if (nextPlans !== plans) {
      setPlans(nextPlans);
      savePlans(nextPlans);
    }
    setActiveWeekStart(weekStartDate);
    setSelectedDate(weekStartDate);
  };

  const handleDateSelect = (date: string) => {
    const weekStartDate = toDateKey(startOfWeek(parseDateKey(date)));
    const nextPlans = ensureWeekPlan(plans, weekStartDate);
    if (nextPlans !== plans) {
      setPlans(nextPlans);
      savePlans(nextPlans);
    }
    setActiveWeekStart(weekStartDate);
    setSelectedDate(date);
  };

  const goToCurrentWeek = () => {
    const weekStart = toDateKey(startOfWeek(new Date()));
    goToWeek(weekStart);
    setSelectedDate(toDateKey(new Date()));
  };

  const addTask = (category: Category, title: string) => {
    updateWeek((week) => ({
      ...week,
      days: week.days.map((day) =>
        day.date === selectedDay.date
          ? { ...day, tasks: [...day.tasks, createTask(title, category, day.date)] }
          : day,
      ),
    }));
  };

  const toggleTask = (taskId: string) => {
    updateWeek((week) => ({
      ...week,
      days: week.days.map((day) =>
        day.date === selectedDay.date
          ? {
              ...day,
              tasks: day.tasks.map((task) =>
                task.id === taskId
                  ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() }
                  : task,
              ),
            }
          : day,
      ),
    }));
  };

  const updateTask = (taskId: string, title: string) => {
    updateWeek((week) => ({
      ...week,
      days: week.days.map((day) =>
        day.date === selectedDay.date
          ? {
              ...day,
              tasks: day.tasks.map((task) =>
                task.id === taskId ? { ...task, title, updatedAt: new Date().toISOString() } : task,
              ),
            }
          : day,
      ),
    }));
  };

  const deleteTask = (taskId: string) => {
    updateWeek((week) => ({
      ...week,
      days: week.days.map((day) =>
        day.date === selectedDay.date
          ? { ...day, tasks: day.tasks.filter((task) => task.id !== taskId) }
          : day,
      ),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-[1600px] px-5 pb-10 sm:px-8">
        <WeekNavigator
          weekStartDate={activeWeek.weekStartDate}
          weekEndDate={activeWeek.weekEndDate}
          onPreviousWeek={() => goToWeek(getRelativeWeekStart(activeWeekStart, -1))}
          onNextWeek={() => goToWeek(getRelativeWeekStart(activeWeekStart, 1))}
          onCurrentWeek={goToCurrentWeek}
        />

        <section className="grid grid-cols-7 gap-5 overflow-x-auto pb-2">
          {activeWeek.days.map((day) => (
            <DayCard
              key={day.date}
              day={day}
              selected={day.date === selectedDay.date}
              onSelect={setSelectedDate}
            />
          ))}
        </section>

        <TaskBoard
          day={selectedDay}
          onDateSelect={handleDateSelect}
          onAddTask={addTask}
          onToggleTask={toggleTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
        />

        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,0.7fr)]">
          <WeeklyProgressChart week={activeWeek} />
          <WeeklySummaryCard week={activeWeek} />
        </section>
      </main>
    </div>
  );
}

export default App;
