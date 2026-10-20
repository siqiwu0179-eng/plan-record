import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Heart,
  MapPin,
  Minus,
  Pencil,
  Plane,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cities, formatCityOption, getCity, type City } from "../data/travelCities";
import {
  TRAVEL_ROUTES_STORAGE_KEY,
  getTravelSummary,
  readTravelRoutes,
  type TravelRoute,
} from "../utils/travel";
import { removeTravelRoute, saveTravelRoute } from "../utils/cloud";
import { Sidebar } from "./Sidebar";
import { DashboardPageHeader } from "./DashboardPageHeader";
import type { WorkspaceView } from "../views";

type TravelDashboardProps = {
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  onBack: (view?: WorkspaceView) => void;
};

const routeColors = ["#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4"];

const formatShortDate = (value: string) => value.replace(/-/g, ".");

const getDateRange = (startDate: string, endDate = startDate) => {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
        cursor.getDate(),
      ).padStart(2, "0")}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  color,
  details,
}: {
  icon: typeof MapPin;
  label: string;
  value: string | number;
  suffix: string;
  color: string;
  details?: string[];
}) {
  return (
    <article className="flex min-h-0 flex-col items-start justify-between gap-1.5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: color }}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 w-full">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-lg font-bold text-slate-950 dark:text-white">
          {value} <span className="text-[11px] font-medium text-slate-400">{suffix}</span>
        </p>
      </div>
      {details && (
        <div className="thin-scrollbar mt-0.5 flex min-h-0 w-full flex-1 content-start items-start gap-1 overflow-y-auto border-t border-slate-200/60 pt-1.5 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <div className="flex w-full flex-wrap content-start items-start gap-1">
            {details.map((detail, index) => (
              <span
                key={detail}
                className={`inline-flex max-w-full items-center border border-dashed border-slate-300/90 bg-white/45 px-2 py-1 leading-none shadow-[0_2px_8px_rgba(15,23,42,0.025)] dark:border-slate-600 dark:bg-slate-800/45 ${
                  index % 3 === 0
                    ? "rounded-[999px_720px_900px_680px]"
                    : index % 3 === 1
                      ? "rounded-[680px_999px_720px_900px]"
                      : "rounded-[850px_680px_999px_720px]"
                }`}
              >
                <span className="truncate">{detail}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

const mapWidth = 960;
const mapHeight = 540;
const minimumMapZoom = 1.06;
const maximumMapZoom = 6;

// The illustration is Pacific-centred and slightly compressed horizontally.
// Project every city from its real coordinates instead of maintaining a small
// list of hand-positioned markers (which sent unknown cities to the ocean).
const mapLeftLongitude = -35;
const mapXOffset = 6.33;
const mapLongitudeScale = 2.4212;

const getMapPoint = (cityId: string): [number, number] => {
  const city = getCity(cityId);
  const wrappedLongitude =
    ((city.lng - mapLeftLongitude) % 360 + 360) % 360;
  const x = mapXOffset + wrappedLongitude * mapLongitudeScale;
  const y =
    320.0114 -
    3.00877 * city.lat +
    0.00365818 * city.lat * city.lat;

  return [
    Math.max(12, Math.min(mapWidth - 12, x)),
    Math.max(12, Math.min(mapHeight - 12, y)),
  ];
};

const getRoutePath = ([startX, startY]: [number, number], [endX, endY]: [number, number]) => {
  let wrappedEndX = endX;
  if (endX - startX > mapWidth / 2) wrappedEndX -= mapWidth;
  if (startX - endX > mapWidth / 2) wrappedEndX += mapWidth;

  const deltaX = wrappedEndX - startX;
  const deltaY = endY - startY;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  let normalX = -deltaY / distance;
  let normalY = deltaX / distance;

  // Give every flight the same geographic bow: primarily northward, and for
  // near-vertical legs consistently eastward. Reversing a route therefore
  // produces the same arc instead of an apparently random bend.
  if (normalY > 0 || (Math.abs(normalY) < 0.08 && normalX < 0)) {
    normalX *= -1;
    normalY *= -1;
  }

  const curvature = Math.min(96, Math.max(18, distance * 0.18));
  const controlX = (startX + wrappedEndX) / 2 + normalX * curvature;
  const controlY = (startY + endY) / 2 + normalY * curvature;
  const primary = `M ${startX} ${startY} Q ${controlX} ${controlY} ${wrappedEndX} ${endY}`;

  if (wrappedEndX < 0) {
    return `${primary} M ${startX + mapWidth} ${startY} Q ${controlX + mapWidth} ${controlY} ${wrappedEndX + mapWidth} ${endY}`;
  }
  if (wrappedEndX > mapWidth) {
    return `${primary} M ${startX - mapWidth} ${startY} Q ${controlX - mapWidth} ${controlY} ${wrappedEndX - mapWidth} ${endY}`;
  }
  return primary;
};

function SearchableCitySelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (cityId: string) => void;
}) {
  const selectedCity = getCity(value);
  const [query, setQuery] = useState(formatCityOption(selectedCity));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(formatCityOption(selectedCity));
  }, [selectedCity]);

  const filteredCities = useMemo(() => {
    const terms = query
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const matches = terms.length
      ? cities.filter((city) => {
          const haystack = city.searchTerms.toLocaleLowerCase();
          return terms.every((term) => haystack.includes(term));
        })
      : cities;

    return [...matches].sort((a, b) => {
      const aChina = a.country.startsWith("中国") ? 0 : 1;
      const bChina = b.country.startsWith("中国") ? 0 : 1;
      return (
        aChina - bChina ||
        a.country.localeCompare(b.country, "zh-CN") ||
        a.name.localeCompare(b.name, "zh-CN")
      );
    });
  }, [query]);

  const chooseCity = (city: City) => {
    onChange(city.id);
    setQuery(formatCityOption(city));
    setOpen(false);
  };

  return (
    <label className="relative grid gap-1.5 text-sm font-semibold" htmlFor={id}>
      {label}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          id={id}
          type="search"
          value={query}
          autoComplete="off"
          spellCheck={false}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              setQuery(formatCityOption(getCity(value)));
            }, 100);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery(formatCityOption(getCity(value)));
            }
            if (event.key === "Enter" && open && filteredCities[0]) {
              event.preventDefault();
              chooseCity(filteredCities[0]);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          placeholder="搜索或直接选择国家、地区、城市"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-blue-900/40"
        />
      </div>
      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          className="absolute left-0 right-0 top-[72px] z-40 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          {filteredCities.length > 0 ? (
            filteredCities.map((city) => (
              <button
                key={city.id}
                type="button"
                role="option"
                aria-selected={city.id === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseCity(city)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-normal transition hover:bg-blue-50 dark:hover:bg-slate-700 ${
                  city.id === value ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : ""
                }`}
              >
                <span>
                  <span className="font-semibold">{city.country}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  {city.name}
                </span>
                <span className="ml-3 truncate text-[11px] text-slate-400">
                  {city.searchTerms.split(" ").slice(-2).join(" ")}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-5 text-center text-sm font-normal text-slate-500">
              暂未找到匹配城市
            </p>
          )}
          <p className="sticky bottom-0 mt-1 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-normal text-slate-400 dark:bg-slate-900">
            {filteredCities.length > 0
              ? `找到 ${filteredCities.length} 个城市，可输入中文或英文继续筛选`
              : `城市库共收录 ${cities.length} 个全球城市`}
          </p>
        </div>
      )}
    </label>
  );
}

function WorldTravelMap({
  visitedCities,
  routes,
}: {
  visitedCities: City[];
  routes: TravelRoute[];
}) {
  const [zoom, setZoom] = useState(minimumMapZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const clampZoom = (value: number) => Math.max(minimumMapZoom, Math.min(maximumMapZoom, value));
  const clampPan = (x: number, y: number, scale = zoom) => {
    const maxX = (mapWidth * (scale - 1)) / 2;
    const maxY = (mapHeight * (scale - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };
  const updateZoom = (delta: number) =>
    setZoom((current) => {
      const next = clampZoom(Number((current + delta).toFixed(2)));
      setPan((currentPan) =>
        next <= minimumMapZoom
          ? { x: 0, y: 0 }
          : clampPan(currentPan.x, currentPan.y, next),
      );
      return next;
    });
  const resetMap = () => {
    setZoom(minimumMapZoom);
    setPan({ x: 0, y: 0 });
    setHoveredRouteId(null);
  };

  const mapRoutes = useMemo(
    () =>
      routes.map((route) => ({
        ...route,
        path: getRoutePath(getMapPoint(route.from), getMapPoint(route.to)),
      })),
    [routes],
  );
  const hoveredRoute = mapRoutes.find((route) => route.id === hoveredRouteId) ?? null;

  return (
    <div
      className="relative aspect-[16/9] h-auto min-h-0 w-full overflow-hidden rounded-[24px] border border-sky-100 bg-transparent shadow-[0_10px_30px_rgba(60,148,190,0.12)] dark:border-slate-700"
      onWheel={(event) => {
        event.preventDefault();
        updateZoom(event.deltaY < 0 ? 0.12 : -0.12);
      }}
    >
      <svg
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        preserveAspectRatio="none"
        className={`h-full w-full touch-none select-none ${zoom > minimumMapZoom ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        role="img"
        aria-label="显示旅行城市和航线的世界地图"
        onPointerDown={(event) => {
          if (zoom <= minimumMapZoom) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragStart.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            panX: pan.x,
            panY: pan.y,
          };
        }}
        onPointerMove={(event) => {
          if (!dragStart.current) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const unitScale = mapWidth / rect.width;
          const nextX =
            dragStart.current.panX +
            (event.clientX - dragStart.current.pointerX) * unitScale;
          const nextY =
            dragStart.current.panY +
            (event.clientY - dragStart.current.pointerY) * unitScale;
          setPan(clampPan(nextX, nextY));
        }}
        onPointerUp={(event) => {
          dragStart.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        <defs>
          <marker
            id="route-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#64788f" />
          </marker>
        </defs>
        <g
          transform={`translate(${pan.x} ${pan.y}) translate(${mapWidth / 2} ${mapHeight / 2}) scale(${zoom}) translate(${-mapWidth / 2} ${-mapHeight / 2})`}
        >
          <image
            href="/travel-world-map.png"
            x={0}
            y={0}
            width={mapWidth}
            height={mapHeight}
            preserveAspectRatio="none"
          />
          {mapRoutes.map((route) => {
            const isHovered = hoveredRouteId === route.id;
            return (
            <g
              key={route.id}
              onMouseEnter={() => setHoveredRouteId(route.id)}
              onMouseLeave={() =>
                setHoveredRouteId((current) => (current === route.id ? null : current))
              }
            >
              <path
                d={route.path}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                pointerEvents="stroke"
              />
              <path
                d={route.path}
                fill="none"
                stroke="rgba(255,255,255,.78)"
                strokeWidth={isHovered ? 5 : 3.8}
                strokeLinecap="round"
                opacity={0.72}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
              <path
                d={route.path}
                fill="none"
                stroke={isHovered ? route.color : "#64788f"}
                strokeWidth={isHovered ? 2.2 : 1.45}
                strokeDasharray="5 3"
                strokeLinecap="round"
                markerEnd="url(#route-arrow)"
                opacity={isHovered ? 1 : 0.92}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            </g>
            );
          })}
          {visitedCities.map((city) => {
            const [x, y] = getMapPoint(city.id);
            const connectedRoute = [...mapRoutes]
              .reverse()
              .find((route) => route.from === city.id || route.to === city.id);
            const isEndpoint =
              hoveredRoute?.from === city.id || hoveredRoute?.to === city.id;
            return (
              <g
                key={city.id}
                transform={`translate(${x} ${y})`}
                className="cursor-help"
                tabIndex={0}
                aria-label={`${city.name}旅行地点`}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseEnter={() => connectedRoute && setHoveredRouteId(connectedRoute.id)}
                onMouseLeave={() =>
                  connectedRoute &&
                  setHoveredRouteId((current) =>
                    current === connectedRoute.id ? null : current,
                  )
                }
                onFocus={() => connectedRoute && setHoveredRouteId(connectedRoute.id)}
                onBlur={() =>
                  connectedRoute &&
                  setHoveredRouteId((current) =>
                    current === connectedRoute.id ? null : current,
                  )
                }
              >
                <circle r={10} fill="transparent" />
                <circle
                  r={isEndpoint ? 6.2 : 5.2}
                  fill="white"
                  stroke={city.color}
                  strokeWidth={1.8}
                  vectorEffect="non-scaling-stroke"
                />
                <circle r={1.8} fill={city.color} />
              </g>
            );
          })}
          {hoveredRoute &&
            [getCity(hoveredRoute.from), getCity(hoveredRoute.to)].map(
              (city, index, endpoints) => {
                const [x, y] = getMapPoint(city.id);
                const [otherX, otherY] = getMapPoint(endpoints[index === 0 ? 1 : 0].id);
                let nearestOtherX = otherX;
                if (otherX - x > mapWidth / 2) nearestOtherX -= mapWidth;
                if (x - otherX > mapWidth / 2) nearestOtherX += mapWidth;

                const outwardX = x - nearestOtherX;
                const outwardY = y - otherY;
                let horizontalDirection =
                  outwardX === 0 ? (index === 0 ? -1 : 1) : Math.sign(outwardX);
                let verticalOffset =
                  Math.abs(outwardY) < 6 ? -8 : outwardY > 0 ? 18 : -10;

                if (x < 70) horizontalDirection = 1;
                if (x > mapWidth - 70) horizontalDirection = -1;
                if (y < 36) verticalOffset = 18;
                if (y > mapHeight - 36) verticalOffset = -10;

                const horizontalOffset = horizontalDirection * 14;

                return (
                  <text
                    key={`label-${hoveredRoute.id}-${city.id}`}
                    x={horizontalOffset}
                    y={verticalOffset}
                    textAnchor={horizontalDirection < 0 ? "end" : "start"}
                    fill="#172033"
                    stroke="rgba(255,255,255,.96)"
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    fontSize={12}
                    fontWeight={700}
                    pointerEvents="none"
                    transform={`translate(${x} ${y})`}
                  >
                    {city.name}
                  </text>
                );
              },
            )}
        </g>
      </svg>
      <div className="absolute bottom-3 left-3 flex items-center overflow-hidden rounded-xl border border-white/75 bg-white/88 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/88">
        <button
          type="button"
          onClick={() => updateZoom(-0.25)}
          disabled={zoom <= minimumMapZoom}
          className="flex h-9 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="缩小地图"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={() => updateZoom(0.25)}
          disabled={zoom >= maximumMapZoom}
          className="flex h-9 w-10 items-center justify-center border-x border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="放大地图"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={resetMap}
          disabled={zoom === 1}
          className="flex h-9 items-center gap-1.5 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="重置地图缩放"
        >
          <RotateCcw size={14} />
          重置
        </button>
      </div>
    </div>
  );
}

function TravelCalendarCard({
  calendarYear,
  calendarMonth,
  calendarCells,
  routes,
  onPrevious,
  onNext,
}: {
  calendarYear: number;
  calendarMonth: number;
  calendarCells: Array<number | null>;
  routes: TravelRoute[];
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">旅行日历</h2>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <button type="button" onClick={onPrevious} aria-label="上个月">
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[74px] text-center">
            {calendarYear}年{calendarMonth + 1}月
          </span>
          <button type="button" onClick={onNext} aria-label="下个月">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-7 text-center text-[10px] text-slate-400">
        {"日一二三四五六".split("").map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid flex-1 content-center grid-cols-7 gap-y-1.5 text-center text-[10px]">
        {calendarCells.map((day, index) => {
          const dateKey = day
            ? `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            : "";
          const routeIndex = routes.findIndex(
            (route) =>
              dateKey >= route.date && dateKey <= (route.endDate ?? route.date),
          );
          return (
            <span
              key={`${day}-${index}`}
              className={`mx-auto flex h-5 w-6 items-center justify-center rounded ${
                routeIndex >= 0
                  ? "font-bold text-white"
                  : "text-slate-600 dark:text-slate-300"
              }`}
              style={
                routeIndex >= 0
                  ? { background: routeColors[routeIndex % routeColors.length] }
                  : undefined
              }
            >
              {day}
            </span>
          );
        })}
      </div>
    </article>
  );
}

function DestinationStrip({
  entries,
  favorites,
  onToggleFavorite,
}: {
  entries: Array<{ city: City; latestVisit: string }>;
  favorites: string[];
  onToggleFavorite: (cityId: string) => void;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-2 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mb-1 flex items-center gap-2">
        <MapPin size={16} className="text-blue-500" />
        <h2 className="text-sm font-bold">旅行目的地</h2>
      </div>
      <div
        className="thin-scrollbar flex min-h-0 flex-1 snap-x items-stretch gap-2.5 overflow-x-auto pb-1.5"
        aria-label="按最近旅行日期倒序排列的旅行目的地"
      >
        {entries.map(({ city, latestVisit }) => {
          const favorite = favorites.includes(city.id);
          return (
            <article
              key={city.id}
              className="group relative h-full min-h-0 min-w-[185px] flex-[0_0_185px] snap-start overflow-hidden rounded-xl"
            >
              <img
                src={city.image}
                alt={`${city.name}城市风景`}
                className="h-full w-full bg-slate-200 object-cover transition duration-500 group-hover:scale-105 dark:bg-slate-800"
                onError={(event) => {
                  const image = event.currentTarget;
                  if (image.src !== city.fallbackImage) image.src = city.fallbackImage;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/10 to-transparent" />
              <button
                type="button"
                onClick={() => onToggleFavorite(city.id)}
                className="absolute right-2 top-2 text-white drop-shadow"
                aria-label={favorite ? "取消收藏" : "收藏目的地"}
              >
                <Heart size={16} fill={favorite ? "white" : "transparent"} />
              </button>
              <div className="absolute inset-x-2.5 bottom-2 text-white">
                <p className="text-sm font-bold">{city.name}</p>
                <div className="flex items-center justify-between text-[10px] text-white/80">
                  <span>{city.country}</span>
                  <span>{latestVisit ? formatShortDate(latestVisit) : "待探索"}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function TravelDashboard({
  sidebarOpen,
  onSidebarToggle,
  onBack,
}: TravelDashboardProps) {
  const [now, setNow] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<TravelRoute[]>(readTravelRoutes);
  const [form, setForm] = useState({
    from: "beijing",
    to: "tokyo",
    date: "2026-08-04",
    endDate: "2026-08-08",
  });
  const [favorites, setFavorites] = useState<string[]>(["sydney", "tokyo"]);
  const [calendarOffset, setCalendarOffset] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(TRAVEL_ROUTES_STORAGE_KEY, JSON.stringify(routes));
  }, [routes]);

  const visitedCityIds = useMemo(
    () => Array.from(new Set(routes.flatMap((route) => [route.from, route.to]))),
    [routes],
  );
  const visitedCities = useMemo(() => visitedCityIds.map(getCity), [visitedCityIds]);
  const countryCount = new Set(visitedCities.map((city) => city.country)).size;
  const { totalDistance } = getTravelSummary(routes);

  const calendarBase = new Date(now.getFullYear(), now.getMonth() + calendarOffset, 1);
  const calendarYear = calendarBase.getFullYear();
  const calendarMonth = calendarBase.getMonth();
  const firstWeekday = calendarBase.getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const destinationEntries = visitedCities
    .map((city) => ({
      city,
      latestVisit: routes
        .filter((route) => route.from === city.id || route.to === city.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? "",
    }))
    .sort((a, b) => b.latestVisit.localeCompare(a.latestVisit));
  const recentRoutes = [...routes].sort((a, b) => b.date.localeCompare(a.date));
  const travelDays = new Set(
    routes.flatMap((route) => getDateRange(route.date, route.endDate)),
  ).size;

  const openRouteForm = (route?: TravelRoute) => {
    if (route) {
      setEditingRouteId(route.id);
      setForm({
        from: route.from,
        to: route.to,
        date: route.date,
        endDate: route.endDate ?? route.date,
      });
    } else {
      setEditingRouteId(null);
      setForm({
        from: "beijing",
        to: "tokyo",
        date: now.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10),
      });
    }
    setShowForm(true);
  };

  const closeRouteForm = () => {
    setShowForm(false);
    setEditingRouteId(null);
  };

  const saveRoute = () => {
    if (form.from === form.to || !form.date || !form.endDate || form.endDate < form.date) return;
    setRoutes((current) => {
      if (editingRouteId) {
        const next = current.map((route) =>
          route.id === editingRouteId ? { ...route, ...form } : route,
        );
        const index = next.findIndex((route) => route.id === editingRouteId);
        if (index >= 0) void saveTravelRoute(next[index], index);
        return next;
      }
      const route = {
        id: `route-${Date.now()}`,
        ...form,
        color: routeColors[current.length % routeColors.length],
      };
      void saveTravelRoute(route, current.length);
      return [...current, route];
    });
    closeRouteForm();
  };

  return (
    <div className="workbench-shell min-h-screen text-slate-950 transition-colors dark:text-white">
      <div className="mx-auto flex min-h-screen max-w-[1920px] flex-col lg:flex-row">
        <Sidebar
          open={sidebarOpen}
          activeView="travel"
          onToggle={onSidebarToggle}
          onNavigate={(view) => onBack(view)}
        />
        <main className="inner-page-scroll-room min-w-0 flex-1 px-3 pb-8 sm:px-4">
          <div className="mx-auto w-full max-w-[1400px]">
        <DashboardPageHeader
          title="我的旅行"
          menuOpen={sidebarOpen}
          onMenuToggle={onSidebarToggle}
          onBack={() => onBack()}
          icon={Plane}
        />

        <section className="mx-1 mt-3.5 grid w-[calc(100%-0.5rem)] gap-3 xl:h-[calc(100vh-7rem)] xl:min-h-[460px] xl:grid-cols-[minmax(230px,290px)_minmax(520px,775px)_minmax(270px,310px)] xl:items-stretch xl:justify-center">
          <div className="grid min-h-0 grid-rows-[minmax(210px,0.9fr)_minmax(0,1.1fr)] gap-3">
            <TravelCalendarCard
              calendarYear={calendarYear}
              calendarMonth={calendarMonth}
              calendarCells={calendarCells}
              routes={routes}
              onPrevious={() => setCalendarOffset((value) => value - 1)}
              onNext={() => setCalendarOffset((value) => value + 1)}
            />

            <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-3">
              <StatCard icon={Globe2} label="到访国家/地区" value={countryCount} suffix="个国家/地区" color="#10b981" details={Array.from(new Set(visitedCities.map((city) => city.country)))} />
              <StatCard icon={MapPin} label="到访城市" value={visitedCities.length} suffix="个城市" color="#3b82f6" details={visitedCities.map((city) => city.name)} />
              <StatCard icon={Plane} label="累计飞行里程" value={totalDistance.toLocaleString()} suffix="公里" color="#8b5cf6" />
              <StatCard icon={CalendarDays} label="旅行天数" value={travelDays} suffix="天" color="#f59e0b" />
            </div>
          </div>

          <div className="grid min-h-0 min-w-0 content-start grid-rows-[auto_minmax(124px,1fr)] gap-3">
            <WorldTravelMap visitedCities={visitedCities} routes={routes} />
            <DestinationStrip
              entries={destinationEntries}
              favorites={favorites}
              onToggleFavorite={(cityId) =>
                setFavorites((current) =>
                  current.includes(cityId)
                    ? current.filter((id) => id !== cityId)
                    : [...current, cityId],
                )
              }
            />
          </div>

          <article className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane size={18} className="text-blue-500" />
                <h2 className="font-bold">我的航线</h2>
              </div>
              <button
                type="button"
                onClick={() => openRouteForm()}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                <Plus size={14} /> 新增
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 divide-x divide-slate-200 rounded-xl bg-slate-50 p-2.5 dark:divide-slate-700 dark:bg-slate-800/70">
              <div>
                <p className="text-[11px] text-slate-500">航线总数</p>
                <p className="text-xl font-bold text-blue-600">{routes.length}<span className="ml-1 text-xs font-normal">条</span></p>
              </div>
              <div className="pl-4">
                <p className="text-[11px] text-slate-500">到达城市</p>
                <p className="text-xl font-bold text-emerald-500">{visitedCities.length}<span className="ml-1 text-xs font-normal">个</span></p>
              </div>
            </div>
            <div
              className="thin-scrollbar mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1"
              style={{ scrollbarGutter: "stable" }}
            >
              {recentRoutes.map((route) => (
                <div key={route.id} className="group flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg px-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: route.color }} />
                  <span className="w-10 truncate font-medium">{getCity(route.from).name}</span>
                  <span className="flex-1 border-t border-dashed border-slate-300 dark:border-slate-600" />
                  <Plane size={13} className="shrink-0 text-slate-400" />
                  <span className="w-10 truncate font-medium">{getCity(route.to).name}</span>
                  <span className="w-[64px] text-right text-[10px] text-slate-400">
                    {formatShortDate(route.date).slice(5)}
                    {route.endDate && route.endDate !== route.date
                      ? `–${formatShortDate(route.endDate).slice(5)}`
                      : ""}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openRouteForm(route)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700"
                      aria-label={`编辑${getCity(route.from).name}到${getCity(route.to).name}的航线`}
                      title="编辑航线"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRoutes((current) => current.filter((item) => item.id !== route.id));
                        void removeTravelRoute(route.id);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-slate-700"
                      aria-label="删除航线"
                      title="删除航线"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveRoute();
            }}
            className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{editingRouteId ? "编辑航线" : "新增航线"}</h2>
                <p className="mt-1 text-sm text-slate-500">选择城市与日期，航线将立即显示在世界地图上。</p>
              </div>
              <button type="button" onClick={closeRouteForm} className="text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="关闭">
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 grid gap-4">
              <SearchableCitySelect
                id="route-from-city"
                label="出发城市"
                value={form.from}
                onChange={(cityId) => setForm((current) => ({ ...current, from: cityId }))}
              />
              <SearchableCitySelect
                id="route-to-city"
                label="到达城市"
                value={form.to}
                onChange={(cityId) => setForm((current) => ({ ...current, to: cityId }))}
              />
              <label className="grid gap-1.5 text-sm font-semibold">
                出发日期
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                结束日期
                <input
                  type="date"
                  value={form.endDate}
                  min={form.date}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endDate: event.target.value }))
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </label>
            </div>
            {form.from === form.to && <p className="mt-3 text-sm text-red-500">出发城市和到达城市不能相同。</p>}
            {form.endDate < form.date && (
              <p className="mt-3 text-sm text-red-500">结束日期不能早于出发日期。</p>
            )}
            <button
              type="submit"
              disabled={form.from === form.to || form.endDate < form.date}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {editingRouteId ? <Pencil size={17} /> : <Plane size={17} />}
              {editingRouteId ? "保存修改" : "生成航线"}
            </button>
          </form>
        </div>
      )}
          </main>
        </div>
      </div>
  );
}
