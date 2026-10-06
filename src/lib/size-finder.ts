import type { LocationKey } from "@/config/locations";

export const STORAGE_NEEDS = [
  { id: "boxes", label: "Boxes, seasonal belongings, or a dorm room", minArea: 25, maxArea: 50, sizes: "5′×5′ to 5′×10′" },
  { id: "apt1", label: "A studio or one-bedroom apartment", minArea: 50, maxArea: 100, sizes: "5′×10′ to 10′×10′" },
  { id: "home2", label: "A two- to three-bedroom home", minArea: 150, maxArea: 200, sizes: "10′×15′ to 10′×20′" },
  { id: "home4", label: "A larger household move", minArea: 200, maxArea: 300, sizes: "10′×20′ to 10′×30′" },
  { id: "business", label: "Business stock, tools, or equipment", minArea: 50, maxArea: 200, sizes: "5′×10′ to 10′×20′" },
  { id: "vehicle", label: "A car, RV, boat, or trailer", minArea: 0, maxArea: 0, sizes: "Vehicle storage or parking" },
] as const;

export type StorageNeed = (typeof STORAGE_NEEDS)[number]["id"];
export type SizeFinderAnswer = { what?: StorageNeed; sensitive?: boolean; location?: LocationKey | "" };

/** Match the advertised size range, which can cross the catalog's size categories. */
export function sizeFinderHref(answer: SizeFinderAnswer): string {
  const choice = STORAGE_NEEDS.find((w) => w.id === answer.what);
  if (!choice) return "/units";
  const params = new URLSearchParams();
  const climate = choice.id !== "vehicle" && answer.sensitive;
  if (choice.id === "vehicle") params.set("size", "parking");
  else {
    params.set("minArea", String(choice.minArea));
    params.set("maxArea", String(choice.maxArea));
  }
  // Haley Road is the only location with confirmed climate-controlled storage.
  if (climate) {
    params.set("location", "haley");
    params.set("climate", "1");
  } else if (answer.location) params.set("location", answer.location);
  return `/units?${params}`;
}
