import { createContext, Fragment, useContext } from "react";
import type { WorkspaceView } from "../views";

export const NavigationContext = createContext<{
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
} | null>(null);

const destinations: { view: WorkspaceView; label: string }[] = [
  { view: "daily", label: "每日计划" },
  { view: "longterm", label: "长期计划" },
  { view: "progress", label: "周完成度" },
  { view: "travel", label: "我的旅行" },
  { view: "mood", label: "心情日记" },
];

export function GlobalNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation || navigation.activeView === "home") return null;
  return (
    <nav aria-label="全局导航" className="ml-auto hidden shrink-0 items-center gap-4 whitespace-nowrap text-sm font-medium md:flex xl:gap-6">
      {destinations.filter(({ view }) => view !== navigation.activeView).map(({ view, label }, index) => (
        <Fragment key={view}>
          {index > 0 && <span aria-hidden="true" className="font-normal text-slate-400">|</span>}
          <a
            href={`#${view}`}
            onClick={(event) => {
              event.preventDefault();
              navigation.onNavigate(view);
            }}
            className="text-slate-500 no-underline transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100"
          >
            {label}
          </a>
        </Fragment>
      ))}
    </nav>
  );
}
