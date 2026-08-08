import { useEffect, useMemo, useState } from "react";
import { DayCard } from "./components/DayCard";
import { DashboardPageHeader } from "./components/DashboardPageHeader";
import { Header } from "./components/Header";
import { HomeDashboard } from "./components/HomeDashboard";
import { MoodDashboard } from "./components/MoodDashboard";
import { Sidebar } from "./components/Sidebar";
import { TaskBoard } from "./components/TaskBoard";
import { TravelDashboard } from "./components/TravelDashboard";
import { WeekNavigator } from "./components/WeekNavigator";
import { WeeklyProgressChart } from "./components/WeeklyProgressChart";
import { WeeklySummaryCard } from "./components/WeeklySummaryCard";
import type { Category, WeekPlan } from "./types";
import { parseDateKey, startOfWeek, toDateKey } from "./utils/date";
import { createTask, ensureWeekPlan, getRelativeWeekStart, loadPlans, savePlans } from "./utils/storage";
import type { WorkspaceView } from "./views";

type StoredPlans = Record<string, WeekPlan>;
type Theme = "light" | "dark";

function App() {
  const initialWeekStart = toDateKey(startOfWeek(new Date()));
  const [plans, setPlans] = useState<StoredPlans>(() => loadPlans());
  const [activeWeekStart, setActiveWeekStart] = useState(initialWeekStart);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>("home");
  const [profileName, setProfileName] = useState(
    () => window.localStorage.getItem("plan-record-profile-name")?.trim() || "林溪",
  );
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem("plan-record-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("plan-record-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("plan-record-profile-name", profileName);
  }, [profileName]);

  const navigateTo = (view: WorkspaceView) => {
    setActiveView(view);
    setIsSidebarOpen(false);
  };

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
    <div className="workbench-shell min-h-screen text-slate-950 transition-colors dark:text-white">
      {activeView === "travel" ? (
        <TravelDashboard
          sidebarOpen={isSidebarOpen}
          onSidebarToggle={() => setIsSidebarOpen((value) => !value)}
          onBack={(view) => navigateTo(view ?? "home")}
        />
      ) : (
      <>
        {activeView === "home" && <Header
          theme={theme}
          onThemeToggle={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
          sidebarOpen={isSidebarOpen}
          onSidebarToggle={() => setIsSidebarOpen((value) => !value)}
          profileName={profileName}
          onProfileNameChange={setProfileName}
        />}
      <div className="mx-auto flex min-h-screen max-w-[1920px] flex-col lg:flex-row">
        <Sidebar
          open={isSidebarOpen}
          activeView={activeView}
          onToggle={() => setIsSidebarOpen((value) => !value)}
          onNavigate={navigateTo}
        />

        <main className="min-w-0 flex-1">
          {activeView === "home" ? (
            <HomeDashboard
              week={activeWeek}
              profileName={profileName}
              onNavigate={navigateTo}
            />
          ) : activeView === "mood" ? (
            <MoodDashboard
              menuOpen={isSidebarOpen}
              onMenuToggle={() => setIsSidebarOpen((value) => !value)}
              onBack={() => navigateTo("home")}
            />
          ) : activeView === "daily" ? (
          <div className="inner-page-scroll-room px-3 pb-8 sm:px-4">
          <div className="mx-auto w-full max-w-[1400px]">
          <DashboardPageHeader
            title="每日计划"
            menuOpen={isSidebarOpen}
            onMenuToggle={() => setIsSidebarOpen((value) => !value)}
            onBack={() => navigateTo("home")}
          />
          <section className="mx-1">
            <WeekNavigator
              weekStartDate={activeWeek.weekStartDate}
              weekEndDate={activeWeek.weekEndDate}
              onPreviousWeek={() => goToWeek(getRelativeWeekStart(activeWeekStart, -1))}
              onNextWeek={() => goToWeek(getRelativeWeekStart(activeWeekStart, 1))}
              onCurrentWeek={goToCurrentWeek}
            />

            <div className="grid grid-cols-7 gap-5 overflow-x-auto pb-2">
              {activeWeek.days.map((day) => (
                <DayCard
                  key={day.date}
                  day={day}
                  selected={day.date === selectedDay.date}
                  onSelect={setSelectedDate}
                />
              ))}
            </div>

            <TaskBoard
              day={selectedDay}
              onDateSelect={handleDateSelect}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
            />
          </section>
          </div>
          </div>
          ) : (
          <div className="inner-page-scroll-room px-3 pb-8 sm:px-4">
          <div className="mx-auto w-full max-w-[1400px]">
          <DashboardPageHeader
            title="周完成度"
            menuOpen={isSidebarOpen}
            onMenuToggle={() => setIsSidebarOpen((value) => !value)}
            onBack={() => navigateTo("home")}
          />
          <section
            className="mx-1 grid gap-5 py-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,0.7fr)]"
          >
            <WeeklyProgressChart week={activeWeek} darkMode={theme === "dark"} />
            <WeeklySummaryCard week={activeWeek} />
          </section>
          </div>
          </div>
          )}
        </main>
      </div>
      </>
      )}
    </div>
  );
}

export default App;
