import { CalendarDays, ChartNoAxesCombined, Heart, Home, Menu, PanelLeftClose, Plane } from "lucide-react";
import type { WorkspaceView } from "../views";

type SidebarProps = {
  open: boolean;
  activeView: WorkspaceView;
  onToggle: () => void;
  onNavigate: (view: WorkspaceView) => void;
};

const navigationItems = [
  { view: "home" as const, label: "首页", icon: Home },
  {
    view: "daily" as const,
    label: "每日计划",
    icon: CalendarDays,
  },
  {
    view: "progress" as const,
    label: "周完成度",
    icon: ChartNoAxesCombined,
  },
  { view: "travel" as const, label: "我的旅行", icon: Plane },
  { view: "mood" as const, label: "心情日记", icon: Heart },
];

export function Sidebar({ open, activeView, onToggle, onNavigate }: SidebarProps) {
  return (
    <aside
      className={`glass-sidebar fixed left-4 top-[5.5rem] z-50 w-64 overflow-hidden rounded-2xl border border-white/70 shadow-xl transition-all duration-200 ${
        open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      }`}
      aria-hidden={!open}
    >
      <nav
        aria-label="页面目录"
        className="overflow-hidden p-3"
      >
        <div className="flex h-11 items-center justify-between px-3">
          <span className="font-bold text-slate-900">目录</span>
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? "隐藏目录" : "打开目录"}
            aria-expanded={open}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
          >
            <PanelLeftClose size={19} />
          </button>
        </div>

          <div className="border-t border-slate-100 p-2">
            {navigationItems.map(({ view, label, icon: Icon }) => (
              <button
                type="button"
                key={view}
                onClick={() => onNavigate(view)}
                aria-current={activeView === view ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition ${
                  activeView === view
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
      </nav>
    </aside>
  );
}
