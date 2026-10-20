import { Dumbbell, NotebookText, Plus, Utensils, WalletCards } from "lucide-react";
import { useState } from "react";
import { CATEGORY_META } from "../constants";
import type { Category, Task } from "../types";
import { countCompleted } from "../utils/stats";
import { TaskItem } from "./TaskItem";

const categoryIcons = {
  study: NotebookText,
  exercise: Dumbbell,
  diet: Utensils,
  other: WalletCards,
};

type CategoryCardProps = {
  category: Category;
  tasks: Task[];
  onAddTask: (category: Category, title: string) => void;
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
};

export function CategoryCard({
  category,
  tasks,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
}: CategoryCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const meta = CATEGORY_META[category];
  const Icon = categoryIcons[category];
  const completedCount = countCompleted(tasks);

  const addTask = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddTask(category, trimmed);
    setTitle("");
    setIsAdding(false);
  };

  return (
    <article className={`flex min-h-[290px] flex-col rounded-2xl border ${meta.borderClass} ${meta.bgClass} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.iconBgClass} ${meta.textClass}`}>
            <Icon size={20} />
          </span>
          <div>
            <h3 className="text-lg font-bold text-slate-950">{meta.label}</h3>
            <p className="text-sm font-medium text-slate-500">
              {completedCount} / {tasks.length}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding((value) => !value)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold ${meta.textClass} shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50`}
        >
          <Plus size={16} />
          添加
        </button>
      </div>

      {isAdding && (
        <div className="mt-4 flex gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTask();
              if (event.key === "Escape") setIsAdding(false);
            }}
            placeholder={`添加${meta.label}任务`}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-400 focus:ring-4"
            autoFocus
          />
          <button
            type="button"
            onClick={addTask}
            className="rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            确定
          </button>
        </div>
      )}

      <ul className="thin-scrollbar mt-4 flex-1 space-y-1 overflow-y-auto pr-1">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              colorClass={meta.textClass}
              onToggle={onToggleTask}
              onUpdate={onUpdateTask}
              onDelete={onDeleteTask}
            />
          ))
        ) : (
          <li className="rounded-lg border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-sm text-slate-400">
            今日暂无任务
          </li>
        )}
      </ul>
    </article>
  );
}
