import { CalendarCheck2, ChartNoAxesCombined, CloudSun, Heart, MapPin, Pencil, Plane, Sun } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { WeekPlan } from "../types";
import { toDateKey } from "../utils/date";
import { TRAVEL_ROUTES_STORAGE_KEY, getTravelSummary, readTravelRoutes } from "../utils/travel";
import type { WorkspaceView } from "../views";

type HomeDashboardProps = {
  week: WeekPlan;
  profileName: string;
  onNavigate: (view: WorkspaceView) => void;
};

const DEFAULT_MOTTO = "专注当下，记录成长，遇见更好的自己。";

type WeatherSnapshot = {
  temperature: number;
  weatherCode: number;
  max: number;
  min: number;
};

const weatherLabel = (code: number) => {
  if (code === 0) return "晴";
  if (code <= 2) return "晴间多云";
  if (code === 3) return "阴";
  if (code === 45 || code === 48) return "有雾";
  if (code >= 51 && code <= 57) return "毛毛雨";
  if (code >= 61 && code <= 67) return "有雨";
  if (code >= 71 && code <= 77) return "有雪";
  if (code >= 80 && code <= 82) return "阵雨";
  if (code >= 85 && code <= 86) return "阵雪";
  if (code >= 95) return "雷雨";
  return "天气变化";
};

export function HomeDashboard({ week, profileName, onNavigate }: HomeDashboardProps) {
  const [now, setNow] = useState(new Date());
  const [editingMotto, setEditingMotto] = useState(false);
  const [motto, setMotto] = useState(
    () => window.localStorage.getItem("plan-record-home-motto") || DEFAULT_MOTTO,
  );
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [travelSummary, setTravelSummary] = useState(() => getTravelSummary(readTravelRoutes()));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("plan-record-home-motto", motto);
  }, [motto]);
  useEffect(() => {
    const syncTravelSummary = () => {
      setTravelSummary(getTravelSummary(readTravelRoutes()));
    };
    const handleTravelStorage = (event: StorageEvent) => {
      if (event.key === TRAVEL_ROUTES_STORAGE_KEY) syncTravelSummary();
    };
    window.addEventListener("storage", handleTravelStorage);
    window.addEventListener("focus", syncTravelSummary);
    return () => {
      window.removeEventListener("storage", handleTravelStorage);
      window.removeEventListener("focus", syncTravelSummary);
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const loadWeather = async () => {
      try {
        const response = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=39.9042&longitude=116.4074&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=1",
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
        const data = (await response.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
          daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
        };
        const temperature = data.current?.temperature_2m;
        const weatherCode = data.current?.weather_code;
        const max = data.daily?.temperature_2m_max?.[0];
        const min = data.daily?.temperature_2m_min?.[0];
        if ([temperature, weatherCode, max, min].some((value) => typeof value !== "number")) {
          throw new Error("Weather response is incomplete");
        }
        if (!disposed) {
          setWeather({
            temperature: temperature as number,
            weatherCode: weatherCode as number,
            max: max as number,
            min: min as number,
          });
          setWeatherError(false);
        }
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) {
          setWeatherError(true);
        }
      }
    };
    void loadWeather();
    const refreshTimer = window.setInterval(loadWeather, 15 * 60 * 1000);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  }, []);

  const greeting = now.getHours() < 12 ? "早上好" : now.getHours() < 18 ? "下午好" : "晚上好";
  const date = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(now);
  const todayKey = toDateKey(now);
  const dayRates = useMemo(
    () => week.days.map((day) => {
      if (!day.tasks.length) return 0;
      return Math.round((day.tasks.filter((task) => task.completed).length / day.tasks.length) * 100);
    }),
    [week],
  );
  const weekTaskCount = week.days.reduce((total, day) => total + day.tasks.length, 0);
  const weekCompletedCount = week.days.reduce(
    (total, day) => total + day.tasks.filter((task) => task.completed).length,
    0,
  );
  const weekRate = weekTaskCount ? Math.round((weekCompletedCount / weekTaskCount) * 100) : 0;
  const currentDayIndex = Math.max(0, week.days.findIndex((day) => day.date === todayKey));
  const currentDay = week.days[currentDayIndex] ?? week.days[0];
  const tasks = (currentDay?.tasks ?? []).slice(0, 3);

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 pb-8 pt-10 lg:px-12">
      <section>
        <div className="flex items-center gap-3"><h2 className="font-serif text-4xl tracking-wide text-slate-900 sm:text-5xl">{greeting}，{profileName || "林溪"}</h2><Sun size={38} className="text-amber-400" /></div>
        <div className="group mt-3 flex max-w-2xl items-center gap-2 tracking-wide text-slate-600">
          {editingMotto ? (
            <input
              autoFocus
              value={motto}
              maxLength={60}
              onChange={(event) => setMotto(event.target.value)}
              onBlur={() => {
                if (!motto.trim()) setMotto(DEFAULT_MOTTO);
                setEditingMotto(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setMotto(window.localStorage.getItem("plan-record-home-motto") || DEFAULT_MOTTO);
                  setEditingMotto(false);
                }
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border border-white/70 bg-white/65 px-2 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              aria-label="编辑首页寄语"
            />
          ) : (
            <p>{motto}</p>
          )}
          <button
            type="button"
            onClick={() => setEditingMotto(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 opacity-0 transition hover:bg-white/70 hover:text-blue-600 focus:opacity-100 group-hover:opacity-100"
            aria-label="编辑首页寄语"
            title="编辑寄语"
          >
            <Pencil size={14} />
          </button>
        </div>
        <article className="glass-panel mt-7 grid w-fit max-w-full grid-cols-[auto_auto] items-center rounded-3xl px-7 py-4">
          <div className="pr-6">
            <time className="block text-4xl font-light tabular-nums">{now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
            <p className="mt-1 text-xs font-semibold text-slate-600">{date.replace("星期", "周")}</p>
          </div>
          <div className="flex items-center gap-3 border-l border-slate-300/60 pl-6">
            <CloudSun size={34} className="text-amber-400" />
            <div>
              <p className="text-xl font-bold">
                {weather ? `${Math.round(weather.temperature)}°C` : weatherError ? "--°C" : "获取中"}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                {weather
                  ? `${weatherLabel(weather.weatherCode)} · ${Math.round(weather.min)}° / ${Math.round(weather.max)}°`
                  : weatherError
                    ? "天气暂不可用"
                    : "正在更新实时天气"}
                <span aria-hidden="true">·</span>
                <MapPin size={12} /> 北京
              </p>
            </div>
          </div>
        </article>
      </section>
      <section className="mt-auto grid items-stretch gap-4 pt-8 md:grid-cols-2 xl:grid-cols-4">
        <button onClick={() => onNavigate("daily")} className="glass-panel home-card text-left">
          <h3 className="flex items-center gap-3 font-bold"><CalendarCheck2 className="text-blue-500" /> 每日计划</h3>
          <div className="mt-4 space-y-2.5 text-sm">{tasks.length ? tasks.map((task) => <div key={task.id} className="flex items-center gap-2"><span className={`h-4 w-4 rounded-full border ${task.completed ? "border-blue-500 bg-blue-500 shadow-[inset_0_0_0_3px_white]" : "border-slate-300 bg-white/70"}`} /><span className="truncate">{task.title}</span></div>) : <p className="text-sm text-slate-500">今日暂无计划</p>}</div>
          <p className="home-detail-link">查看详情　›</p>
        </button>
        <button onClick={() => onNavigate("progress")} className="glass-panel home-card text-left">
          <h3 className="flex items-center gap-3 font-bold"><ChartNoAxesCombined className="text-indigo-500" /> 周完成度</h3>
          <div className="mt-1 flex min-h-0 flex-1 items-center justify-around"><div className="progress-orbit" style={{ "--progress": `${weekRate}%` } as CSSProperties}><span>{weekRate}%</span></div><div className="flex h-20 items-end gap-2">{dayRates.map((rate,i)=><span key={week.days[i]?.date ?? i} className={`w-4 rounded-t ${i===currentDayIndex?"bg-blue-500":"bg-blue-200/80"}`} style={{height:`${Math.max(rate, 7)}%`}} title={`${rate}%`} />)}</div></div>
          <p className="home-detail-link">查看详情　›</p>
        </button>
        <button onClick={() => onNavigate("travel")} className="glass-panel home-card text-left">
          <h3 className="flex items-center gap-3 font-bold"><Plane className="text-sky-500" /> 我的旅行</h3>
          <div className="mt-3 grid grid-cols-[80px_1fr] items-center gap-3"><div><p className="text-2xl leading-none">{travelSummary.visitedCityCount}</p><p className="mt-1 text-xs leading-none text-slate-500">到访城市</p><p className="mt-2 text-lg leading-none">{travelSummary.totalDistance.toLocaleString()}</p><p className="mt-1 text-[10px] leading-none text-slate-500">公里</p></div><img src="/travel-world-map.png" alt="" className="h-20 w-full rounded-xl object-cover opacity-55" /></div>
          <p className="home-detail-link">查看详情　›</p>
        </button>
        <button onClick={() => onNavigate("mood")} className="glass-panel home-card text-left">
          <h3 className="flex items-center gap-3 font-bold"><Heart className="text-rose-400" fill="currentColor" /> 心情日记</h3>
          <div className="mt-4 flex items-center gap-3"><span className="text-4xl">🙂</span><div><p className="text-xl font-bold">平静</p><p className="text-xs text-slate-500">今日心情</p></div></div>
          <p className="home-detail-link">查看详情　›</p>
        </button>
      </section>
    </div>
  );
}
