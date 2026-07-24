import { Bell, CheckCircle2, Moon, Sun, UserRound } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [calmMode, setCalmMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserCard, setShowUserCard] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950">计划与记录</h1>
            <p className="hidden text-sm text-slate-500 sm:block">每周计划、每日执行、持续复盘</p>
          </div>
        </div>

        <div className="relative flex items-center gap-3">
          <button
            className={`hidden h-10 w-10 items-center justify-center rounded-lg border shadow-sm transition hover:bg-slate-50 sm:flex ${
              calmMode
                ? "border-blue-100 bg-blue-50 text-blue-600"
                : "border-slate-200 bg-white text-amber-500"
            }`}
            aria-label="主题"
            aria-pressed={calmMode}
            type="button"
            onClick={() => setCalmMode((value) => !value)}
          >
            {calmMode ? <Moon size={21} /> : <Sun size={21} />}
          </button>
          <button
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="通知"
            type="button"
            onClick={() => {
              setShowNotifications((value) => !value);
              setShowUserCard(false);
            }}
          >
            <Bell size={20} />
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 ring-1 ring-slate-200"
            aria-label="用户"
            type="button"
            onClick={() => {
              setShowUserCard((value) => !value);
              setShowNotifications(false);
            }}
          >
            <UserRound size={22} />
          </button>

          {showNotifications && (
            <div className="absolute right-12 top-12 w-56 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-soft">
              <p className="font-bold text-slate-900">通知</p>
              <p className="mt-2 text-slate-500">本周计划已自动保存。</p>
            </div>
          )}

          {showUserCard && (
            <div className="absolute right-0 top-12 w-52 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-soft">
              <p className="font-bold text-slate-900">本地用户</p>
              <p className="mt-2 text-slate-500">数据保存在当前浏览器。</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
