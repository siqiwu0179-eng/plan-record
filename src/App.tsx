import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./components/AuthScreen";
import { DayCard } from "./components/DayCard";
import { DashboardPageHeader } from "./components/DashboardPageHeader";
import { NavigationContext } from "./components/GlobalNavigation";
import { Header } from "./components/Header";
import { HomeDashboard } from "./components/HomeDashboard";
import { LongTermPlansOverlay } from "./components/LongTermPlansOverlay";
import { LongTermReference } from "./components/LongTermReference";
import { MoodDashboard } from "./components/MoodDashboard";
import { Sidebar } from "./components/Sidebar";
import { TaskBoard } from "./components/TaskBoard";
import { TravelDashboard } from "./components/TravelDashboard";
import { WeekNavigator } from "./components/WeekNavigator";
import { WeeklyProgressChart } from "./components/WeeklyProgressChart";
import { WeeklySummaryCard } from "./components/WeeklySummaryCard";
import { clearLongTermStores, getLongTermStore } from "./utils/longTermStore";
import { supabase } from "./lib/supabase";
import type { Category, WeekPlan } from "./types";
import { parseDateKey, startOfWeek, toDateKey } from "./utils/date";
import { createWeekPlan, createTask, ensureWeekPlan, getRelativeWeekStart } from "./utils/storage";
import {
  applyCloudData,
  clearLegacyBusinessCache,
  clearLocalUserData,
  createInitialCloudData,
  flushCloudMutations,
  getLocalCloudData,
  loadAvatarObjectUrl,
  loadCloudData,
  removeMoodRecord,
  removePlanTask,
  removeTravelRoute,
  saveMoodRecord,
  savePlanTask,
  saveTravelRoute,
  saveUserPreferences,
  uploadProfileAvatar,
} from "./utils/cloud";
import type { MoodRecord } from "./utils/mood";
import type { TravelRoute } from "./utils/travel";
import { setAnalyticsUserId, startAnalytics, trackPageView } from "./utils/analytics";
import type { WorkspaceView } from "./views";

type StoredPlans = Record<string, WeekPlan>;
type Theme = "light" | "dark";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);

  const initialWeekStart = toDateKey(startOfWeek(new Date()));
  const [plans, setPlans] = useState<StoredPlans>(() => ({ [initialWeekStart]: createWeekPlan(initialWeekStart) }));
  const [moodRecords, setMoodRecords] = useState<Record<string, MoodRecord>>({});
  const [travelRoutes, setTravelRoutes] = useState<TravelRoute[]>([]);
  const [saveError, setSaveError] = useState("");
  const [activeWeekStart, setActiveWeekStart] = useState(initialWeekStart);
  const [completionWeekStart, setCompletionWeekStart] = useState(initialWeekStart);
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
      if (!nextSession || (hydratedUserId && hydratedUserId !== nextSession.user.id)) clearLongTermStores();
      if (mounted) setCloudReady(false);
      if (!nextSession) {
        hydratedUserId = null;
        clearLocalUserData();
        if (mounted) {
          setSession(null);
          setPlans({ [initialWeekStart]: createWeekPlan(initialWeekStart) });
          setMoodRecords({});
          setTravelRoutes([]);
          setProfileName("林溪");
          setAvatarUrl(null);
        }
        return;
      }

      let hydrationSucceeded = false;
      try {
        const longTermStore = getLongTermStore(nextSession.user.id);
        const [cloudData] = await Promise.all([
          loadCloudData(nextSession),
          longTermStore.refresh(),
        ]);
        const effectiveData = cloudData ?? createInitialCloudData(nextSession);

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
          setPlans(ensureWeekPlan(effectiveData.plans, initialWeekStart));
          setMoodRecords(effectiveData.moods);
          setTravelRoutes(effectiveData.travelRoutes);
          setProfileName(effectiveData.profileName || "林溪");
          setAvatarUrl(nextAvatarUrl);
          setTheme(effectiveData.theme);
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

  useEffect(() => {
    clearLegacyBusinessCache();
    startAnalytics();
  }, []);

  useEffect(() => {
    const handleSaveError = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string }>).detail;
      setSaveError(`${detail?.label || "数据"}保存失败，当前内容仍保留在本页面，请检查网络后再次操作。`);
    };
    window.addEventListener("plan-record-save-error", handleSaveError);
    return () => window.removeEventListener("plan-record-save-error", handleSaveError);
  }, []);

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
    if (view !== "home" && !session && supabase) {
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
      return nextPlans;
    });
  }, [activeWeekStart]);

  const activeWeek = useMemo(() => {
    return plans[activeWeekStart] ?? ensureWeekPlan(plans, activeWeekStart)[activeWeekStart];
  }, [activeWeekStart, plans]);

  const completionWeek = useMemo(() => plans[completionWeekStart] ?? createWeekPlan(completionWeekStart), [plans, completionWeekStart]);

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
      return nextPlans;
    });
  };

  const goToWeek = (weekStartDate: string) => {
    const nextPlans = ensureWeekPlan(plans, weekStartDate);
    if (nextPlans !== plans) {
      setPlans(nextPlans);
    }
    setActiveWeekStart(weekStartDate);
    setSelectedDate(weekStartDate);
  };

  const handleDateSelect = (date: string) => {
    const weekStartDate = toDateKey(startOfWeek(parseDateKey(date)));
    const nextPlans = ensureWeekPlan(plans, weekStartDate);
    if (nextPlans !== plans) {
      setPlans(nextPlans);
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

  const addLongTermStepToDaily = async (title: string, category: Category) => {
    if (!session || !cloudReady) throw new Error("请等待账户数据加载完成后重试");
    const today = toDateKey(new Date());
    const weekStart = toDateKey(startOfWeek(parseDateKey(today)));
    const task = createTask(title, category, today);
    const currentWeek = ensureWeekPlan(plans, weekStart)[weekStart];
    setPlans(current => {
      const next = ensureWeekPlan(current, weekStart);
      const week = next[weekStart];
      const updated = { ...next, [weekStart]: { ...week, days: week.days.map(day => day.date === today ? { ...day, tasks: [...day.tasks, task] } : day) } };
      return updated;
    });
    void savePlanTask(task, currentWeek.days.find(day => day.date === today)?.tasks.length ?? 0);
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

  const updateMoodRecord = (date: string, record: MoodRecord) => {
    setMoodRecords((current) => ({ ...current, [date]: record }));
    void saveMoodRecord(date, record);
  };

  const deleteMoodRecord = (date: string) => {
    setMoodRecords((current) => {
      const next = { ...current };
      delete next[date];
      return next;
    });
    void removeMoodRecord(date);
  };

  const updateTravelRoute = (route: TravelRoute, sortOrder: number) => {
    setTravelRoutes((current) => {
      const index = current.findIndex((item) => item.id === route.id);
      if (index < 0) return [...current, route];
      return current.map((item) => item.id === route.id ? route : item);
    });
    void saveTravelRoute(route, sortOrder);
  };

  const deleteTravelRoute = (routeId: string) => {
    setTravelRoutes((current) => current.filter((item) => item.id !== routeId));
    void removeTravelRoute(routeId);
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
    setPlans({ [initialWeekStart]: createWeekPlan(initialWeekStart) });
    setMoodRecords({});
    setTravelRoutes([]);
    setProfileName("林溪");
    setAvatarUrl(null);
    navigateTo("home");
  };

  const handleAvatarChange = async (file: File) => {
    if (!session) throw new Error("请先登录");
    const avatarPath = await uploadProfileAvatar(session, file);
    const nextAvatarUrl = await loadAvatarObjectUrl(avatarPath);
    setAvatarUrl(nextAvatarUrl);
  };

  return (
    <NavigationContext.Provider value={{ activeView, onNavigate: navigateTo }}>
    <div className="workbench-shell min-h-screen text-slate-950 transition-colors dark:text-white">
      {activeView === "travel" ? (
        <TravelDashboard
          routes={travelRoutes}
          onSaveRoute={updateTravelRoute}
          onDeleteRoute={deleteTravelRoute}
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
              week={activeWeek}
              moodRecords={moodRecords}
              travelRoutes={travelRoutes}
              profileName={session ? profileName : "朋友"}
              onNavigate={navigateTo}
            />
          ) : activeView === "longterm" ? (
            <LongTermReference
              key={`longterm-${session?.user.id ?? "guest"}`}
              userId={session?.user.id ?? null}
              cloudReady={cloudReady}
              onAddDaily={addLongTermStepToDaily}
              menuOpen={isSidebarOpen}
              onMenuToggle={() => setIsSidebarOpen((value) => !value)}
              onBack={() => navigateTo("home")}
            />
          ) : activeView === "mood" ? (
            <MoodDashboard
              records={moodRecords}
              onSaveRecord={updateMoodRecord}
              onDeleteRecord={deleteMoodRecord}
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
          <section className="mx-1">
            <WeekNavigator
              weekStartDate={completionWeek.weekStartDate}
              weekEndDate={completionWeek.weekEndDate}
              onPreviousWeek={() => setCompletionWeekStart((current) => getRelativeWeekStart(current, -1))}
              onNextWeek={() => setCompletionWeekStart((current) => getRelativeWeekStart(current, 1))}
              onDateSelect={(date) => setCompletionWeekStart(toDateKey(startOfWeek(parseDateKey(date))))}
              onCurrentWeek={() => setCompletionWeekStart(toDateKey(startOfWeek(new Date())))}
            />
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,0.7fr)]">
              <WeeklyProgressChart week={completionWeek} darkMode={theme === "dark"} />
              <WeeklySummaryCard week={completionWeek} />
            </div>
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
      {saveError && (
        <div role="alert" className="fixed bottom-6 left-1/2 z-[200] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-600 shadow-xl dark:border-red-900 dark:bg-slate-900">
          <span>{saveError}</span>
          <button type="button" aria-label="关闭保存失败提示" onClick={() => setSaveError("")} className="shrink-0 text-lg leading-none">×</button>
        </div>
      )}
    </div>
    </NavigationContext.Provider>
  );
}

export default App;
