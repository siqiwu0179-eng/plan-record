import { Bell, Menu, Moon, PanelLeftClose, Sun } from "lucide-react";
import { useState } from "react";

type HeaderProps = {
  theme: "light" | "dark";
  onThemeToggle: () => void;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  profileName: string;
  onProfileNameChange: (name: string) => void;
  hideBrand?: boolean;
};

export function Header({
  theme,
  onThemeToggle,
  sidebarOpen,
  onSidebarToggle,
  profileName,
  onProfileNameChange,
  hideBrand = false,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserCard, setShowUserCard] = useState(false);

  return (
    <header className={hideBrand
      ? "absolute inset-x-0 top-0 z-30 bg-transparent"
      : "sticky top-0 z-30 border-b border-white/55 bg-white/48 transition-colors dark:border-slate-700/70 dark:bg-slate-950/70"
    }>
      <div className="px-3 sm:px-4">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onSidebarToggle} aria-label={sidebarOpen ? "隐藏目录" : "打开目录"} className="glass-button flex h-10 w-10 items-center justify-center rounded-xl text-slate-600">
            {sidebarOpen ? <PanelLeftClose size={20} /> : <Menu size={20} />}
          </button>
          {!hideBrand && <div>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-white">个人工作台</h1>
          </div>}
        </div>

        <div className="relative flex items-center gap-2 sm:gap-3">
          <button
            className="glass-button hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold sm:flex"
            aria-label={theme === "dark" ? "切换到明亮模式" : "切换到暗色模式"}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? "切换到明亮模式" : "切换到暗色模式"}
            type="button"
            onClick={onThemeToggle}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            <span>{theme === "dark" ? "深色模式" : "浅色模式"}</span>
          </button>
          <button
            className="glass-button relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600"
            aria-label="通知"
            type="button"
            onClick={() => {
              setShowNotifications((value) => !value);
              setShowUserCard(false);
            }}
          >
            <Bell size={20} />
            <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-rose-400 ring-2 ring-white" />
          </button>
          <button
            className="glass-button flex h-10 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-slate-600"
            aria-label="用户"
            type="button"
            onClick={() => {
              setShowUserCard((value) => !value);
              setShowNotifications(false);
            }}
          >
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&q=80" alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="hidden max-w-20 truncate text-sm font-semibold sm:inline">{profileName}</span>
          </button>

          {showNotifications && (
            <div className="absolute right-12 top-12 w-56 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-soft">
              <p className="font-bold text-slate-900">通知</p>
              <p className="mt-2 text-slate-500">本周计划已自动保存。</p>
            </div>
          )}

          {showUserCard && (
            <div className="absolute right-0 top-12 w-60 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-soft">
              <p className="font-bold text-slate-900">本地用户</p>
              <label className="mt-3 block text-xs font-medium text-slate-500" htmlFor="profile-name">
                显示姓名
              </label>
              <input
                id="profile-name"
                value={profileName}
                maxLength={12}
                onChange={(event) => onProfileNameChange(event.target.value)}
                onBlur={() => {
                  if (!profileName.trim()) onProfileNameChange("林溪");
                }}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-2 text-xs text-slate-500">姓名和数据保存在当前浏览器。</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
