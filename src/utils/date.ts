import { WEEKDAY_LABELS } from "../constants";

export const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const startOfWeek = (date: Date): Date => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
};

export const getWeekDateKeys = (weekStartDate: string): string[] => {
  const start = parseDateKey(weekStartDate);
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(start, index)));
};

export const formatMonthDay = (dateKey: string): string => {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

export const formatSlashDate = (dateKey: string): string => {
  const date = parseDateKey(dateKey);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
};

export const formatWeekRange = (weekStartDate: string, weekEndDate: string): string => {
  const start = parseDateKey(weekStartDate);
  const end = parseDateKey(weekEndDate);
  const startText = `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`;
  const endText =
    start.getFullYear() === end.getFullYear()
      ? `${end.getMonth() + 1}月${end.getDate()}日`
      : `${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`;
  return `${startText} - ${endText}`;
};

export const getWeekdayLabel = (dateKey: string): string => {
  const mondayStartIndex = (parseDateKey(dateKey).getDay() + 6) % 7;
  return WEEKDAY_LABELS[mondayStartIndex];
};
