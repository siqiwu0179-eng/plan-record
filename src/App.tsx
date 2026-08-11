import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./components/AuthScreen";
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
import { supabase } from "./lib/supabase";
import type { Category, WeekPlan } from "./types";
import { parseDateKey, startOfWeek, toDateKey } from "./utils/date";
import { createTask, ensureWeekPlan, getRelativeWeekStart, loadPlans, savePlans } from "./utils/storage";
import {
  applyCloudData,
  capturePendingMigration,
  clearLocalUserData,
  completePendingMigration,
  getLocalCloudData,
  getPendingMigration,
  loadAvatarObjectUrl,
  loadCloudData,
  saveCloudData,
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
  const [hasPendingMigration, setHasPendingMigration] = useState(false);
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

    const hydrate = async (nextSession: Session | null) => {
      if (mounted) setCloudReady(false);
      if (!nextSession) {
        const pendingMigration = capturePendingMigration();
        clearLocalUserData();
        if (mounted) {
          setHasPendingMigration(Boolean(pendingMigration));
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
        const pendingMigration = getPendingMigration();
        const effectiveData = pendingMigration
          ? {
              ...pendingMigration,
              profileName:
                cloudData?.profileName ||
                String(nextSession.user.user_metadata?.full_name ?? "").trim() ||
                pendingMigration.profileName,
              avatarPath: cloudData?.avatarPath ?? null,
            }
          : cloudData;

        if (pendingMigration && effectiveData) {
          await saveCloudData(nextSession, effectiveData);
          completePendingMigration();
          if (mounted) setHasPendingMigration(false);
        }

        if (effectiveData) {
          applyCloudData(effectiveData);
          let nextAvatarUrl: string | null = null;
          if (effectiveData.avatarPath) {
            try {
              nextAvatarUrl = await loadAvatarObjectUrl(effectiveData.avatarPath);
            } catch (error) {
              console.error("Unable to load profile avatar", error);
            }
          }
          if (mounted) {
            setPlans(loadPlans());
            setProfileName(effectiveData.profileName || "林溪");
            setAvatarUrl(nextAvatarUrl);
            setTheme(effectiveData.theme);
            setDataRevision((value) => value + 1);
          }
        } else {
          if (mounted) setAvatarUrl(null);
          const signupName = String(nextSession.user.user_metadata?.full_name ?? "").trim();
          if (signupName) {
            window.localStorage.setItem("plan-record-profile-name", signupName);
            if (mounted) setProfileName(signupName);
          }
          await saveCloudData(nextSession, getLocalCloudData());
        }
        hydrationSucceeded = true;
      } catch (error) {
        console.error("Unable to load plan-record data", error);
      }

      if (mounted) {
        setSession(nextSession);
        setCloudReady(hydrationSucceeded);
        setShowAuthModal(false);
      }
    };

    void supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
    if (session && cloudReady) void saveCloudData(session, getLocalCloudData());
  }, [profileName, session, cloudReady]);

  useEffect(() => {
    if (!session || !cloudReady) return;
    const persist = () => void saveCloudData(session, getLocalCloudData());
    window.addEventListener("plan-record-data-changed", persist);
    return () => window.removeEventListener("plan-record-data-changed", persist);
  }, [session, cloudReady]);

  const navigateTo = (view: WorkspaceView) => {
    setActiveView(view);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    setPlans((currentPlans) => {
      const nextPlans = ensureWeekPlan(currentPlans, activeWeekStart);
      if (nextPlans !== currentPlans) savePlans(nextPlans);
      if (session && cloudReady && nextPlans !== currentPlans) {
        void saveCloudData(session, getLocalCloudData());
      }
      return nextPlans;
    });
  }, [activeWeekStart, session, cloudReady]);

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
      if (session) void saveCloudData(session, getLocalCloudData());
      return nextPlans;
    });
  };

  const goToWeek = (weekStartDate: string) => {
    const nextPlans = ensureWeekPlan(plans, weekStartDate);
    if (nextPlans !== plans) {
      setPlans(nextPlans);
      savePlans(nextPlans);
      if (session) void saveCloudData(session, getLocalCloudData());
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
      if (session) void saveCloudData(session, getLocalCloudData());
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

  const handleSignOut = async () => {
    if (!supabase || !session) return;
    try {
      await saveCloudData(session, getLocalCloudData());
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
      <AuthScreen
        open={showAuthModal}
        hasPendingMigration={hasPendingMigration}
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
