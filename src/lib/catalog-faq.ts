import { getLocation } from "@/config/locations";
import { formatSize, money, type UnitGroup } from "./catalog";
import type { FaqCategory } from "./faq";

/** Public FAQ guidance uses the current catalogue without editing staff FAQ copy. */
export function catalogueFaq(categories: FaqCategory[], groups: UnitGroup[]): FaqCategory[] {
  const storage = groups.filter((g) => !g.vehicle && g.available > 0);
  const link = (g: UnitGroup) => `[${formatSize(g.widthFt, g.lengthFt)} at ${getLocation(g.locationKey).shortName}](/units/${g.locationKey}/${g.bestUnitId})`;
  return categories.map((category) => ({ ...category, entries: category.entries.map((entry) => {
    if (/^what size do i need\??$/i.test(entry.question.trim())) {
      const sizes = [...new Map(storage.map((g) => [`${g.widthFt}x${g.lengthFt}`, g])).values()];
      const answer = sizes.length
        ? `Start with what you're storing. Sizes currently available include ${sizes.map(link).join(", ")}. Use the [size finder](/size-finder) to compare the closest available sizes for your needs. Measure your largest items and leave room to reach what you need.`
        : "Use the [size finder](/size-finder) or [contact us](/contact) to confirm which sizes are available. Measure your largest items and leave room to reach what you need.";
      return { ...entry, answer };
    }
    if (/exit 31 unit sizes and starting rates/i.test(entry.question)) {
      const hwy = storage.filter((g) => g.locationKey === "hwy4");
      return { ...entry, answer: hwy.length
        ? `At Exit 31 (2784 NS-4, Addington Forks), compare ${hwy.map((g) => `${link(g)} from ${money(g.fromRate)}/month`).join(", ")}. These are starting prices before tax. Checkout shows 14% Nova Scotia HST on its own line before you pay.`
        : "[Check the current catalogue at Exit 31](/units?location=hwy4) or [contact us](/contact) for available sizes and prices." };
    }
    return entry;
  }) }));
}
