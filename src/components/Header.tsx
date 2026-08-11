import { Bell, Camera, LoaderCircle, LogIn, LogOut, Menu, Moon, PanelLeftClose, Sun } from "lucide-react";
import { useState } from "react";

type HeaderProps = {
  theme: "light" | "dark";
  onThemeToggle: () => void;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  profileName: string;
  onProfileNameChange: (name: string) => void;
  avatarUrl: string | null;
  onAvatarChange: (file: File) => Promise<void>;
  isAuthenticated: boolean;
  onLogin: () => void;
  onSignOut: () => void;
  hideBrand?: boolean;
};

export function Header({
  theme,
  onThemeToggle,
  sidebarOpen,
  onSidebarToggle,
  profileName,
  onProfileNameChange,
  avatarUrl,
  onAvatarChange,
  isAuthenticated,
  onLogin,
  onSignOut,
  hideBrand = false,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserCard, setShowUserCard] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");

  const avatarFallback = profileName.trim().slice(0, 1) || "我";

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
            aria-label={isAuthenticated ? "打开账户设置" : "登录"}
            type="button"
            onClick={() => {
              if (isAuthenticated) setShowUserCard((value) => !value);
              else onLogin();
              setShowNotifications(false);
            }}
          >
            {isAuthenticated ? (
              avatarUrl ? (
                <img src={avatarUrl} alt="用户头像" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">{avatarFallback}</span>
              )
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300"><LogIn size={17} /></span>
            )}
            <span className="max-w-20 truncate text-sm font-semibold">{isAuthenticated ? profileName : "登录"}</span>
          </button>

          {showNotifications && (
            <div className="absolute right-12 top-12 w-56 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-soft">
              <p className="font-bold text-slate-900">通知</p>
              <p className="mt-2 text-slate-500">本周计划已自动保存。</p>
            </div>
          )}

          {isAuthenticated && showUserCard && (
            <div className="absolute right-0 top-12 w-72 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-soft dark:border-slate-700 dark:bg-slate-900">
              <p className="font-bold text-slate-900 dark:text-white">账户设置</p>
              <div className="mt-3 grid grid-cols-[64px_minmax(0,1fr)] items-end gap-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">头像</p>
                  <label className="group relative block h-14 w-14 cursor-pointer overflow-hidden rounded-full ring-1 ring-slate-200 dark:ring-slate-700" title="更换头像">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="当前头像" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-indigo-100 text-xl font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">{avatarFallback}</span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      {avatarBusy ? <LoaderCircle className="animate-spin" size={19} /> : <Camera size={19} />}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={avatarBusy}
                      aria-label="上传新头像"
                      className="sr-only"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        setAvatarBusy(true);
                        setAvatarMessage("");
                        try {
                          await onAvatarChange(file);
                        } catch (error) {
                          setAvatarMessage(error instanceof Error ? error.message : "头像上传失败，请重试");
                        } finally {
                          setAvatarBusy(false);
                        }
                      }}
                    />
                  </label>
                </div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="profile-name">
                  名称
                  <input
                    id="profile-name"
                    value={profileName}
                    maxLength={12}
                    onChange={(event) => onProfileNameChange(event.target.value)}
                    onBlur={() => {
                      if (!profileName.trim()) onProfileNameChange("林溪");
                    }}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-950"
                  />
                </label>
              </div>
              {avatarMessage && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{avatarMessage}</p>}
              <button
                type="button"
                onClick={() => {
                  setShowUserCard(false);
                  onSignOut();
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <LogOut size={16} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
