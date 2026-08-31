import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./components/AuthScreen";
import { DayCard } from "./components/DayCard";
import { DashboardPageHeader } from "./components/DashboardPageHeader";
import { Header } from "./components/Header";
import { HomeDashboard } from "./components/HomeDashboard";
import { LongTermPlansOverlay } from "./components/LongTermPlansOverlay";
import { MoodDashboard } from "./components/MoodDashboard";
import { Sidebar } from "./components/Sidebar";
import { TaskBoard } from "./components/TaskBoard";
import { TravelDashboard } from "./components/TravelDashboard";
import { WeekNavigator } from "./components/WeekNavigator";
import { WeeklyProgressChart } from "./components/WeeklyProgressChart";
import { WeeklySummaryCard } from "./components/WeeklySummaryCard";
import { supabase } from "./lib/supabase";
import type { Category, WeekPlan } from "./types";
import { parseDateKey, startOfWeek, toDateKey } from "./utils/date";
import { createTask, ensureWeekPlan, getRelativeWeekStart, loadPlans, savePlans } from "./utils/storage";
import {
  applyCloudData,
  clearLocalUserData,
  createInitialCloudData,
  flushCloudMutations,
  getLocalCloudData,
  loadAvatarObjectUrl,
  loadCloudData,
  removePlanTask,
  saveInitialCloudData,
  savePlanTask,
  saveUserPreferences,
  uploadProfileAvatar,
} from "./utils/cloud";
import { setAnalyticsUserId, startAnalytics, trackPageView } from "./utils/analytics";
import type { WorkspaceView } from "./views";

type StoredPlans = Record<string, WeekPlan>;
type Theme = "light" | "dark";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);

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
    if (!supabase) return;
    let mounted = true;
    let hydrationVersion = 0;
    let hydratedUserId: string | null = null;

    const hydrate = async (nextSession: Session | null) => {
      const requestVersion = ++hydrationVersion;
      if (mounted) setCloudReady(false);
      if (!nextSession) {
        hydratedUserId = null;
        clearLocalUserData();
        if (mounted) {
          setSession(null);
          setPlans(loadPlans());
          setProfileName("林溪");
          setAvatarUrl(null);
          setDataRevision((value) => value + 1);
        }
        return;
      }

      let hydrationSucceeded = false;
      try {
        const cloudData = await loadCloudData(nextSession);
        const effectiveData = cloudData ?? createInitialCloudData(nextSession);

        if (!cloudData) {
          await saveInitialCloudData(nextSession, effectiveData);
        }

        applyCloudData(effectiveData);
        let nextAvatarUrl: string | null = null;
        if (effectiveData.avatarPath) {
          try {
            nextAvatarUrl = await loadAvatarObjectUrl(effectiveData.avatarPath);
          } catch (error) {
            console.error("Unable to load profile avatar", error);
          }
        }
        if (mounted && requestVersion === hydrationVersion) {
          setPlans(loadPlans());
          setProfileName(effectiveData.profileName || "林溪");
          setAvatarUrl(nextAvatarUrl);
          setTheme(effectiveData.theme);
          setDataRevision((value) => value + 1);
        }
        hydratedUserId = nextSession.user.id;
        hydrationSucceeded = true;
      } catch (error) {
        console.error("Unable to load plan-record data", error);
      }

      if (mounted && requestVersion === hydrationVersion) {
        setSession(nextSession);
        setCloudReady(hydrationSucceeded);
        setShowAuthModal(false);
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!(["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT"] as string[]).includes(event)) return;
      if (event === "SIGNED_IN" && nextSession?.user.id === hydratedUserId) return;
      void hydrate(nextSession);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => startAnalytics(), []);

  useEffect(() => {
    return () => {
      if (avatarUrl?.startsWith("blob:")) URL.revokeObjectURL(avatarUrl);
    };
  }, [avatarUrl]);

  useEffect(() => {
    setAnalyticsUserId(session?.user.id ?? null);
  }, [session]);

  useEffect(() => {
    trackPageView(activeView, activeView === "home" ? "home" : "inner");
  }, [activeView, session]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("plan-record-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("plan-record-profile-name", profileName);
    if (session && cloudReady) void saveUserPreferences(session, getLocalCloudData());
  }, [profileName, session, cloudReady]);

  useEffect(() => {
    if (!session || !cloudReady) return;
    const persist = () => void saveUserPreferences(session, getLocalCloudData());
    window.addEventListener("plan-record-data-changed", persist);
    return () => window.removeEventListener("plan-record-data-changed", persist);
  }, [session, cloudReady]);

  const navigateTo = (view: WorkspaceView) => {
    if (view !== "home" && !session) {
      setShowAuthModal(true);
      setIsSidebarOpen(false);
      return;
    }
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
    const task = createTask(title, category, selectedDay.date);
    updateWeek((week) => ({
      ...week,
      days: week.days.map((day) =>
        day.date === selectedDay.date
          ? { ...day, tasks: [...day.tasks, task] }
          : day,
      ),
    }));
    void savePlanTask(task, selectedDay.tasks.length);
  };

  const toggleTask = (taskId: string) => {
    const currentTask = selectedDay.tasks.find((task) => task.id === taskId);
    if (!currentTask) return;
    const nextTask = { ...currentTask, completed: !currentTask.completed, updatedAt: new Date().toISOString() };
    updateWeek((week) => ({
      ...week,
      days: week.days.map((day) =>
        day.date === selectedDay.date
          ? {
              ...day,
              tasks: day.tasks.map((task) =>
                task.id === taskId ? nextTask : task,
              ),
            }
          : day,
      ),
    }));
    void savePlanTask(nextTask, selectedDay.tasks.findIndex((task) => task.id === taskId));
  };

  const updateTask = (taskId: string, title: string) => {
    const currentTask = selectedDay.tasks.find((task) => task.id === taskId);
    if (!currentTask) return;
    const nextTask = { ...currentTask, title, updatedAt: new Date().toISOString() };
    updateWeek((week) => ({
      ...week,
      days: week.days.map((day) =>
        day.date === selectedDay.date
          ? {
              ...day,
              tasks: day.tasks.map((task) =>
                task.id === taskId ? nextTask : task,
              ),
            }
          : day,
      ),
    }));
    void savePlanTask(nextTask, selectedDay.tasks.findIndex((task) => task.id === taskId));
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
    void removePlanTask(taskId);
  };

  const handleSignOut = async () => {
    if (!supabase || !session) return;
    try {
      await saveUserPreferences(session, getLocalCloudData());
      await flushCloudMutations();
    } catch (error) {
      console.error("Unable to save data before sign out", error);
      return;
    }
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      console.error("Unable to sign out", error);
      return;
    }
    clearLocalUserData();
    setSession(null);
    setPlans(loadPlans());
    setProfileName("林溪");
    setAvatarUrl(null);
    setDataRevision((value) => value + 1);
    navigateTo("home");
  };

  const handleAvatarChange = async (file: File) => {
    if (!session) throw new Error("请先登录");
    const avatarPath = await uploadProfileAvatar(session, file);
    const nextAvatarUrl = await loadAvatarObjectUrl(avatarPath);
    setAvatarUrl(nextAvatarUrl);
  };

  return (
    <div className="workbench-shell min-h-screen text-slate-950 transition-colors dark:text-white">
      {activeView === "travel" ? (
        <TravelDashboard
          key={`travel-${dataRevision}`}
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
          avatarUrl={avatarUrl}
          onAvatarChange={handleAvatarChange}
          isAuthenticated={Boolean(session)}
          onLogin={() => setShowAuthModal(true)}
          onSignOut={() => void handleSignOut()}
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
              key={`home-${dataRevision}`}
              week={activeWeek}
              profileName={session ? profileName : "朋友"}
              onNavigate={navigateTo}
            />
          ) : activeView === "mood" ? (
            <MoodDashboard
              key={`mood-${dataRevision}`}
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
      <LongTermPlansOverlay
        key={`long-term-plans-${session?.user.id ?? "guest"}`}
        session={session}
        cloudReady={cloudReady}
        visible={activeView === "home"}
      />
      <AuthScreen
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={(name) => {
          if (name) setProfileName(name);
          setShowAuthModal(false);
        }}
      />
    </div>
  );
}

export default App;
