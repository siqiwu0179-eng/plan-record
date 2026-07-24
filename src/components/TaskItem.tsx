import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Task } from "../types";

type TaskItemProps = {
  task: Task;
  colorClass: string;
  onToggle: (taskId: string) => void;
  onUpdate: (taskId: string, title: string) => void;
  onDelete: (taskId: string) => void;
};

export function TaskItem({ task, colorClass, onToggle, onUpdate, onDelete }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onUpdate(task.id, trimmed);
      setIsEditing(false);
    }
  };

  const cancelEdit = () => {
    setDraft(task.title);
    setIsEditing(false);
  };

  return (
    <li className="group flex min-h-[38px] items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/70">
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
          task.completed
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-slate-300 bg-white text-transparent hover:border-blue-400"
        }`}
        aria-label={task.completed ? "标记为未完成" : "标记为完成"}
      >
        <Check size={14} strokeWidth={3} />
      </button>

      {isEditing ? (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") saveEdit();
            if (event.key === "Escape") cancelEdit();
          }}
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-900 outline-none ring-blue-100 focus:border-blue-400 focus:ring-4"
          autoFocus
        />
      ) : (
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            task.completed ? "text-slate-400 line-through" : "text-slate-800"
          }`}
          title={task.title}
        >
          {task.title}
        </span>
      )}

      {isEditing ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={saveEdit}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700"
            aria-label="保存"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            aria-label="取消"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={`flex h-7 w-7 items-center justify-center rounded-md bg-white ${colorClass} ring-1 ring-slate-200 transition hover:bg-slate-50`}
            aria-label="编辑"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-400 ring-1 ring-slate-200 transition hover:text-red-500"
            aria-label="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </li>
  );
}
