export const MOOD_RECORDS_STORAGE_KEY = "mood-records-v1";

export const MOODS = [
  ["☹️", "低落"],
  ["😕", "有点低落"],
  ["🙂", "平静"],
  ["😊", "开心"],
  ["😄", "非常开心"],
] as const;

export type MoodRecord = {
  mood: number;
  entry: string;
  tags: string[];
};

export const INITIAL_MOOD_RECORDS: Record<string, MoodRecord> = {
  "2026-08-02": {
    mood: 2,
    entry: "周末有些疲惫，但推进了项目的关键部分，值得。",
    tags: ["有一点疲惫"],
  },
  "2026-08-03": {
    mood: 4,
    entry: "专注度很高，完成了几个重要任务，成就感满满。",
    tags: ["充实"],
  },
  "2026-08-04": {
    mood: 3,
    entry: "今天早上跑步，空气很清新，完成了目标配速。",
    tags: ["放松"],
  },
  "2026-08-05": {
    mood: 3,
    entry:
      "傍晚沿着湖边散步，微风拂过，湖面很安静。\n远处的雪山被夕阳染成了淡淡的金色，心里突然觉得很放松。\n今天工作进展顺利，和同事的沟通也很愉快，感到充实和满足。",
    tags: ["充实", "放松"],
  },
  "2026-08-06": { mood: 3, entry: "", tags: [] },
  "2026-08-07": { mood: 2, entry: "", tags: ["有一点疲惫"] },
  "2026-08-08": { mood: 4, entry: "", tags: ["放松"] },
  "2026-08-09": { mood: 3, entry: "", tags: [] },
};

export const readMoodRecords = (): Record<string, MoodRecord> => {
  const stored = window.localStorage.getItem(MOOD_RECORDS_STORAGE_KEY);
  if (!stored) return INITIAL_MOOD_RECORDS;

  try {
    const parsed = JSON.parse(stored) as Record<string, MoodRecord>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : INITIAL_MOOD_RECORDS;
  } catch {
    return INITIAL_MOOD_RECORDS;
  }
};
