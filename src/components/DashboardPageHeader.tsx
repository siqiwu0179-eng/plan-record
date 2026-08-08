import { ArrowLeft, Menu, type LucideIcon } from "lucide-react";

type DashboardPageHeaderProps = {
  title: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onBack: () => void;
  icon?: LucideIcon;
};

export function DashboardPageHeader({
  title,
  menuOpen,
  onMenuToggle,
  onBack,
  icon: Icon,
}: DashboardPageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/50">
      <button
        type="button"
        onClick={onMenuToggle}
        className="glass-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600"
        aria-label={menuOpen ? "隐藏目录" : "打开目录"}
      >
        <Menu size={20} />
      </button>
      <button
        type="button"
        onClick={onBack}
        className="glass-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600"
        aria-label="返回首页"
        title="返回首页"
      >
        <ArrowLeft size={19} />
      </button>
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
          {title}
        </h1>
        {Icon && <Icon className="shrink-0 text-blue-500" size={20} />}
      </div>
    </header>
  );
}
