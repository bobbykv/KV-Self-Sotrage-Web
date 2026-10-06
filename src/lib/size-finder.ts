import type { LocationKey } from "@/config/locations";

export const STORAGE_NEEDS = [
  { id: "boxes", label: "Boxes, seasonal gear or a dorm room", minArea: 25, maxArea: 50, sizes: "5 × 5 to 5 × 10", result: "Start with 5 × 5 to 5 × 10. Check the dimensions of your largest items." },
  { id: "apt1", label: "A studio or one-bedroom apartment", minArea: 50, maxArea: 100, sizes: "5 × 10 to 10 × 10", result: "Start with 5 × 10 to 10 × 10. Bulky furniture may need more space." },
  { id: "home2", label: "A two- or three-bedroom home", minArea: 150, maxArea: 200, sizes: "10 × 15 to 10 × 20", result: "Start with 10 × 15 to 10 × 20. Think about how much you're keeping, not just the number of rooms." },
  { id: "home4", label: "A larger household", minArea: 200, maxArea: 300, sizes: "10 × 20 to 10 × 30", result: "Start with 10 × 20 to 10 × 30. Call us if you need help checking the fit." },
  { id: "business", label: "Business stock, tools or equipment", minArea: 50, maxArea: 200, sizes: "50 to 200 sq. ft.", result: "Compare 50 to 200 sq. ft. Leave room to reach stock and equipment. Tell us what you're storing if you need help." },
  { id: "vehicle", label: "A vehicle, RV or boat", minArea: 0, maxArea: 0, sizes: "Vehicle parking", result: "Check parking at Haley Road. Have your vehicle's length, width and height ready." },
] as const;

export type StorageNeed = (typeof STORAGE_NEEDS)[number]["id"];
export type SizeFinderAnswer = { what?: StorageNeed; sensitive?: boolean | "unsure"; location?: LocationKey | "" };

/** Match the advertised size range, which can cross the catalog's size categories. */
export function sizeFinderHref(answer: SizeFinderAnswer): string {
  const choice = STORAGE_NEEDS.find((w) => w.id === answer.what);
  if (!choice) return "/units";
  const params = new URLSearchParams();
  const climate = choice.id !== "vehicle" && answer.sensitive === true;
  if (choice.id === "vehicle") params.set("type", "parking");
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
