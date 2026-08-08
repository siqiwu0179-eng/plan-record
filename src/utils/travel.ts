import { getCity, type City } from "../data/travelCities";

export type TravelRoute = {
  id: string;
  from: string;
  to: string;
  date: string;
  endDate?: string;
  color: string;
};

export const TRAVEL_ROUTES_STORAGE_KEY = "travel-routes-v1";

export const INITIAL_TRAVEL_ROUTES: TravelRoute[] = [
  { id: "route-1", from: "beijing", to: "tokyo", date: "2026-01-18", endDate: "2026-01-22", color: "#3b82f6" },
  { id: "route-2", from: "tokyo", to: "singapore", date: "2026-03-22", endDate: "2026-03-27", color: "#10b981" },
  { id: "route-3", from: "singapore", to: "sydney", date: "2026-05-14", endDate: "2026-05-20", color: "#f97316" },
  { id: "route-4", from: "sydney", to: "paris", date: "2026-07-28", endDate: "2026-08-03", color: "#8b5cf6" },
  { id: "route-5", from: "paris", to: "new-york", date: "2026-08-02", endDate: "2026-08-08", color: "#ec4899" },
  { id: "route-6", from: "new-york", to: "beijing", date: "2026-08-19", endDate: "2026-08-24", color: "#06b6d4" },
];

const distanceKm = (from: City, to: City) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const latDistance = toRadians(to.lat - from.lat);
  const lngDistance = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(lngDistance / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const readTravelRoutes = () => {
  const stored = window.localStorage.getItem(TRAVEL_ROUTES_STORAGE_KEY);
  if (!stored) return INITIAL_TRAVEL_ROUTES;

  try {
    const routes = JSON.parse(stored) as TravelRoute[];
    if (!Array.isArray(routes)) return INITIAL_TRAVEL_ROUTES;
    return routes.map((route) => ({
      ...route,
      endDate:
        route.endDate ??
        INITIAL_TRAVEL_ROUTES.find((initialRoute) => initialRoute.id === route.id)?.endDate ??
        route.date,
    }));
  } catch {
    return INITIAL_TRAVEL_ROUTES;
  }
};

export const getTravelSummary = (routes: TravelRoute[]) => ({
  visitedCityCount: new Set(routes.flatMap((route) => [route.from, route.to])).size,
  totalDistance: routes.reduce(
    (total, route) => total + distanceKm(getCity(route.from), getCity(route.to)),
    0,
  ),
});
