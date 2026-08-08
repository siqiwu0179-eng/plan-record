import {
  BarChart3,
  CalendarDays,
  Clock3,
  ImagePlus,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toDateKey } from "../utils/date";
import {
  MOODS,
  MOOD_RECORDS_STORAGE_KEY,
  readMoodRecords,
  type MoodRecord,
} from "../utils/mood";
import { DashboardPageHeader } from "./DashboardPageHeader";

const parseDate = (value: string) => new Date(`${value}T12:00:00`);

const formatRecordDate = (value: string) => {
  const date = parseDate(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const getWeekday = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { weekday: "short" })
    .format(parseDate(value))
    .replace("星期", "周");

export function MoodDashboard({
  menuOpen,
  onMenuToggle,
  onBack,
}: {
  menuOpen: boolean;
  onMenuToggle: () => void;
  onBack: () => void;
}) {
  const todayKey = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [records, setRecords] = useState<Record<string, MoodRecord>>(readMoodRecords);
  const [selectedMood, setSelectedMood] = useState(records[todayKey]?.mood ?? 3);
  const [entry, setEntry] = useState(records[todayKey]?.entry ?? "");
  const [availableTags, setAvailableTags] = useState(["充实", "放松", "有一点疲惫"]);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    records[todayKey]?.tags ?? [],
  );
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [saved, setSaved] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const record = records[selectedDate];
    setSelectedMood(record?.mood ?? 3);
    setEntry(record?.entry ?? "");
    setSelectedTags(record?.tags ?? []);
    setSaved(false);
  }, [selectedDate]);

  useEffect(() => {
    window.localStorage.setItem(MOOD_RECORDS_STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const selected = parseDate(selectedDate);
  const calendarYear = selected.getFullYear();
  const calendarMonth = selected.getMonth();
  const calendarCells = useMemo(() => {
    const first = new Date(calendarYear, calendarMonth, 1, 12);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(calendarYear, calendarMonth, 1 - mondayOffset, 12);
    return Array.from({ length: 42 }, (_, index) => {
      const value = new Date(start);
      value.setDate(start.getDate() + index);
      return {
        key: toDateKey(value),
        day: value.getDate(),
        currentMonth: value.getMonth() === calendarMonth,
      };
    });
  }, [calendarMonth, calendarYear]);

  const weeklyTrend = useMemo(() => {
    const focus = parseDate(selectedDate);
    const monday = new Date(focus);
    monday.setDate(focus.getDate() - ((focus.getDay() + 6) % 7));
    return ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map(
      (label, index) => {
        const day = new Date(monday);
        day.setDate(monday.getDate() + index);
        const key = toDateKey(day);
        return { d: label, v: records[key]?.mood ?? null, date: key };
      },
    );
  }, [records, selectedDate]);

  const recordedTrendValues = weeklyTrend
    .map((item) => item.v)
    .filter((value): value is number => value !== null);
  const averageMood = recordedTrendValues.length
    ? Math.round(
        recordedTrendValues.reduce((total, value) => total + value, 0) /
          recordedTrendValues.length,
      )
    : 3;

  const allMoodRecords = useMemo(
    () => Object.entries(records).sort(([dateA], [dateB]) => dateB.localeCompare(dateA)),
    [records],
  );

  const recentRecords = allMoodRecords.slice(0, 7);

  const editMoodRecord = (recordDate: string) => {
    setSelectedDate(recordDate);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
    setSaved(false);
  };

  const removeTag = (tag: string) => {
    setAvailableTags((current) => current.filter((item) => item !== tag));
    setSelectedTags((current) => current.filter((item) => item !== tag));
    setSaved(false);
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag) return;
    setAvailableTags((current) => (current.includes(tag) ? current : [...current, tag]));
    setSelectedTags((current) => (current.includes(tag) ? current : [...current, tag]));
    setNewTag("");
    setAddingTag(false);
    setSaved(false);
  };

  const saveRecord = () => {
    setRecords((current) => {
      const next = {
        ...current,
        [selectedDate]: {
          mood: selectedMood,
          entry,
          tags: selectedTags,
        },
      };
      window.localStorage.setItem(MOOD_RECORDS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSaved(true);
  };

  const deleteRecord = () => {
    if (!records[selectedDate]) return;
    const recordLabel = selectedDate === todayKey ? "今天的心情记录" : `${formatRecordDate(selectedDate)}的心情记录`;
    if (!window.confirm(`确定删除${recordLabel}吗？删除后无法恢复。`)) return;

    setRecords((current) => {
      const next = { ...current };
      delete next[selectedDate];
      window.localStorage.setItem(MOOD_RECORDS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSelectedMood(3);
    setEntry("");
    setSelectedTags([]);
    setSaved(false);
  };

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  };

  return (
    <div className="inner-page-scroll-room px-3 pb-8 sm:px-4">
      <div className="mx-auto w-full max-w-[1400px]">
      <DashboardPageHeader
        title="心情日记"
        menuOpen={menuOpen}
        onMenuToggle={onMenuToggle}
        onBack={onBack}
      />

      <section className="mx-1 mt-3.5 grid gap-3 xl:h-[calc(100vh-7rem)] xl:min-h-[460px] xl:grid-cols-[276px_minmax(430px,1fr)_minmax(420px,1.05fr)]">
        <div className="grid min-h-0 gap-3">
          <article className="glass-panel rounded-2xl p-5">
            <button
              type="button"
              onClick={openDatePicker}
              className="flex items-center gap-2 font-bold transition hover:text-blue-600"
              title="选择日期"
            >
              <CalendarDays size={18} className="text-blue-500" />
              {calendarMonth + 1}月情绪日历
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
              className="pointer-events-none absolute h-px w-px opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            />
            <div className="mt-5 grid grid-cols-7 gap-y-3 text-center text-xs">
              {"一二三四五六日".split("").map((label) => (
                <b key={label}>{label}</b>
              ))}
              {calendarCells.map((cell) => (
                <button
                  type="button"
                  key={cell.key}
                  onClick={() => setSelectedDate(cell.key)}
                  className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full transition ${
                    cell.key === selectedDate
                      ? "bg-blue-500 text-white ring-4 ring-blue-100"
                      : cell.currentMonth
                        ? "text-slate-800 hover:bg-blue-50"
                        : "text-slate-300 hover:bg-white/50"
                  }`}
                  aria-label={`选择${cell.key}`}
                >
                  {cell.day}
                </button>
              ))}
            </div>
          </article>

          <article className="glass-panel rounded-2xl p-5">
            <h3 className="flex items-center gap-2 font-bold">
              <BarChart3 size={18} className="text-blue-500" />
              本月心情
            </h3>
            <div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 text-center">
              <div>
                <p className="text-2xl">🙂</p>
                <b>{Object.values(records).filter((record) => record.mood === 3).length}天</b>
                <p className="text-xs text-slate-500">平静日</p>
              </div>
              <div>
                <p className="text-2xl">😊</p>
                <b>{Object.values(records).filter((record) => record.mood >= 4).length}天</b>
                <p className="text-xs text-slate-500">开心日</p>
              </div>
              <div>
                <p className="text-2xl text-emerald-500">⌁</p>
                <b>{Object.keys(records).length}天</b>
                <p className="text-xs text-slate-500">记录天数</p>
              </div>
            </div>
          </article>
        </div>

        <article className="thin-scrollbar glass-panel min-h-0 overflow-y-auto rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <Pencil size={18} className="text-blue-500" />
            {selectedDate === todayKey ? "记录今天" : `记录${formatRecordDate(selectedDate)}`}
          </h3>
          <p className="mt-5 text-sm font-semibold">这一天感觉怎么样？</p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {MOODS.map(([emoji, label], index) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  setSelectedMood(index + 1);
                  setSaved(false);
                }}
              >
                <span
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/65 text-3xl shadow ${
                    selectedMood === index + 1
                      ? "ring-4 ring-blue-400 ring-offset-2 ring-offset-transparent"
                      : ""
                  }`}
                >
                  {emoji}
                </span>
                <span className="mt-2 block text-xs">{label}</span>
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs text-slate-500">你可以选择一些标签</p>
          <div className="mt-2 flex min-h-8 flex-wrap gap-2">
            {availableTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <div
                  key={tag}
                  className={`group relative inline-flex items-center rounded-full border ${
                    active
                      ? "border-blue-300/80 bg-blue-100/60 text-blue-700 dark:border-blue-400/60 dark:bg-blue-400/15 dark:text-blue-200"
                      : "border-slate-200 bg-white/70 text-slate-600"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="px-4 py-1.5 text-xs"
                  >
                    {tag}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-slate-500 opacity-0 shadow-sm transition hover:bg-white focus:opacity-100 group-hover:opacity-100 dark:bg-slate-700 dark:text-slate-200"
                    aria-label={`删除标签${tag}`}
                    title="删除标签"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
            {addingTag ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addTag();
                    if (event.key === "Escape") {
                      setAddingTag(false);
                      setNewTag("");
                    }
                  }}
                  className="h-8 w-28 rounded-full border border-blue-300 bg-white/80 px-3 text-xs outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="输入新标签"
                />
                <button type="button" onClick={addTag} className="text-xs text-blue-600">
                  添加
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingTag(true)}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/55 px-4 py-1.5 text-xs"
              >
                <Plus size={13} />
                添加标签
              </button>
            )}
          </div>

          <textarea
            value={entry}
            onChange={(event) => {
              setEntry(event.target.value);
              setSaved(false);
            }}
            className="mt-4 h-48 w-full resize-none rounded-2xl border border-white/80 bg-white/52 p-4 text-sm leading-7 outline-none backdrop-blur"
          />
          <div className="mt-2 text-right text-xs text-slate-400">{entry.length}/500</div>
          <div className="mt-3 flex gap-2">
            <button className="glass-button flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
              <ImagePlus size={15} />
              添加照片
            </button>
            <button className="glass-button flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
              <MapPin size={15} />
              添加位置
            </button>
            <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
              <Lock size={14} />
              仅自己可见
            </span>
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={saveRecord}
              className="min-w-52 rounded-xl bg-blue-500 px-8 py-3 font-semibold text-white"
            >
              {saved ? "已保存" : selectedDate === todayKey ? "保存今天" : "保存记录"}
            </button>
            <button
              type="button"
              onClick={deleteRecord}
              disabled={!records[selectedDate]}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white/70 px-4 py-3 text-sm font-semibold text-red-500 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:bg-slate-900/60 dark:hover:bg-red-950/40"
            >
              <Trash2 size={16} />
              删除记录
            </button>
          </div>
        </article>

        <div className="grid h-full min-h-0 gap-3 xl:grid-rows-[304px_minmax(0,1fr)]">
          <article className="glass-panel min-h-0 overflow-hidden rounded-2xl p-5">
            <div className="flex justify-between">
              <h3 className="flex items-center gap-2 font-bold">
                <BarChart3 size={18} className="text-blue-500" />
                本周情绪趋势
              </h3>
              <span className="text-xs text-slate-500">
                平均情绪：{MOODS[averageMood - 1][0]} {MOODS[averageMood - 1][1]}
              </span>
            </div>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={weeklyTrend}
                  margin={{ top: 10, right: 22, bottom: 8, left: 22 }}
                >
                  <CartesianGrid strokeDasharray="4 4" opacity={0.35} vertical={false} />
                  <XAxis
                    dataKey="d"
                    axisLine={false}
                    tickLine={false}
                    padding={{ left: 8, right: 8 }}
                  />
                  <YAxis hide domain={[1, 5]} />
                  <Tooltip />
                  <Line
                    dataKey="v"
                    type="monotone"
                    connectNulls
                    stroke="#4f8df7"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: "white", strokeWidth: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="glass-panel flex min-h-0 flex-col overflow-hidden rounded-2xl p-5">
            <div className="flex shrink-0">
              <h3 className="flex items-center gap-2 font-bold">
                <Clock3 size={18} className="text-blue-500" />
                最近记录
              </h3>
            </div>
            <div className="thin-scrollbar mt-2 min-h-0 flex-1 divide-y divide-slate-200/70 overflow-y-auto pr-1">
              {recentRecords.map(([recordDate, record]) => (
                <div
                  key={recordDate}
                  className="grid grid-cols-[62px_38px_1fr_auto] items-center gap-2 py-3"
                >
                  <div>
                    <b>{formatRecordDate(recordDate)}</b>
                    <p className="text-xs text-slate-500">{getWeekday(recordDate)}</p>
                  </div>
                  <span className="text-3xl">{MOODS[record.mood - 1][0]}</span>
                  <div className="min-w-0">
                    <b className="text-sm">{MOODS[record.mood - 1][1]}的一天</b>
                    <p className="line-clamp-1 text-xs text-slate-500">
                      {record.entry.trim() || "这一天还没有填写文字记录。"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => editMoodRecord(recordDate)}
                    className="glass-button rounded-xl px-3 py-1.5 text-xs"
                  >
                    编辑
                  </button>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
      </div>

    </div>
  );
}
