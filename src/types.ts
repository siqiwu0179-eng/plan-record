export type Category = "study" | "exercise" | "diet" | "other";

export type Task = {
  id: string;
  title: string;
  category: Category;
  date: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DayPlan = {
  date: string;
  tasks: Task[];
};

export type WeekPlan = {
  weekStartDate: string;
  weekEndDate: string;
  days: DayPlan[];
};

export type CategoryMeta = {
  label: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  iconBgClass: string;
};
