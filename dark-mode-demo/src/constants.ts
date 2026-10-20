import type { Category, CategoryMeta } from "./types";

export const CATEGORIES: Category[] = ["study", "exercise", "diet", "other"];

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  study: {
    label: "学习",
    color: "#2563eb",
    bgClass: "bg-blue-50/70",
    borderClass: "border-blue-200",
    textClass: "text-blue-600",
    iconBgClass: "bg-blue-100",
  },
  exercise: {
    label: "锻炼",
    color: "#16a34a",
    bgClass: "bg-green-50/70",
    borderClass: "border-green-200",
    textClass: "text-green-600",
    iconBgClass: "bg-green-100",
  },
  diet: {
    label: "饮食",
    color: "#f97316",
    bgClass: "bg-orange-50/70",
    borderClass: "border-orange-200",
    textClass: "text-orange-600",
    iconBgClass: "bg-orange-100",
  },
  other: {
    label: "其他",
    color: "#7c3aed",
    bgClass: "bg-violet-50/70",
    borderClass: "border-violet-200",
    textClass: "text-violet-600",
    iconBgClass: "bg-violet-100",
  },
};

export const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
