import type { LocationKey } from "@/config/locations";

export type SeoPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
  locations: LocationKey[];
  nearby: string[];
};

/** Location claims follow location-seed.json. Rental and access steps live in checkout. */
export const SEO_PAGES: SeoPage[] = [
  {
    slug: "self-storage-antigonish",
    title: "Self Storage in Antigonish, NS | Space for What Matters",
    description: "Moving, downsizing, or storing between StFX terms? Compare storage sizes and prices in Antigonish, with 24/7 access and climate-controlled options at Haley Road.",
    h1: "Make room for your next chapter in Antigonish",
    intro: "A new home or a smaller space doesn't mean you have to let go of everything. Keep your belongings nearby at Haley Road or Addington Forks while you settle into what comes next.",
    sections: [
      {
        heading: "Keep what you're not ready to part with",
        body: "Store furniture, keepsakes, and extra boxes while you move or downsize. Haley Road is less than a kilometre from downtown Antigonish, with climate-controlled options for belongings that need a more consistent environment.",
      },
      {
        heading: "Room for school or business",
        body: "Between terms at StFX? Keep your belongings near campus at Haley Road. Need room for stock or tools? Compare spaces at both locations and choose one that fits your workday, including Addington Forks at Highway 4, Exit 31.",
      },
      {
        heading: "Choose with confidence",
        body: "Start with the size guide and compare monthly prices. You'll review your full move-in total before payment, and your confirmation will explain the next steps. If you're unsure, tell us what you're storing and we'll help.",
      },
    ],
    locations: ["haley", "hwy4"],
    nearby: ["Antigonish", "St. Andrews", "Lower South River", "Addington Forks", "Lower West River", "Heatherton"],
  },
  {
    slug: "self-storage-new-glasgow",
    title: "Self Storage near New Glasgow, NS | KV Stellarton",
    description: "Keep your belongings close to New Glasgow at KV Self Storage in Stellarton. Find space for a move, a smaller home, or business stock, with 24/7 access.",
    h1: "More room for your life near New Glasgow",
    intro: "Moving, renovating, or making room at home? Give your belongings a place nearby at 30 Heritage Avenue in Stellarton, a short drive from New Glasgow, Westville, and Trenton.",
    sections: [
      {
        heading: "Take your move one step at a time",
        body: "Keep furniture and boxes out of the way while you get settled. You can make space in your home without rushing decisions about belongings you still want to keep.",
      },
      {
        heading: "Keep your things within reach",
        body: "With 24/7 access, you can visit when it fits your day. Gated entry and camera surveillance support your peace of mind, and you'll use the Nokē app for access once your rental and app setup are complete.",
      },
      {
        heading: "Find the size that fits",
        body: "Compare storage sizes and monthly prices, or use the size guide for a starting estimate. Not sure how your furniture will fit? Tell us what you're storing and we'll help you choose.",
      },
    ],
    locations: ["stellarton"],
    nearby: ["New Glasgow", "Stellarton", "Westville", "Trenton", "Pictou", "Plymouth"],
  },
  {
    slug: "self-storage-stellarton",
    title: "Self Storage in Stellarton, NS | Room for Your Next Step",
    description: "Find clean, secure storage at 30 Heritage Avenue in Stellarton. Compare sizes and prices for your move, home, or business, with 24/7 access and local help.",
    h1: "Space for what matters in Stellarton",
    intro: "Your home or workspace can feel crowded when life changes. Keep the belongings you need at 30 Heritage Avenue, and give yourself room to move forward.",
    sections: [
      {
        heading: "Make room without rushing to let go",
        body: "Store furniture, seasonal belongings, and keepsakes while you move or settle into a smaller home. Clean storage, gated entry, and camera surveillance help you feel confident about where you keep them.",
      },
      {
        heading: "Give your business breathing room",
        body: "Keep stock, tools, or equipment out of your day-to-day workspace. With 24/7 access, you can pick up what you need around your own schedule.",
      },
      {
        heading: "Know your next step",
        body: "Choose your space, review the price, and follow the rental steps shown at checkout. Your confirmation explains your lease and access arrangements. Need a hand with size or the Nokē app? Contact us for help.",
      },
    ],
    locations: ["stellarton"],
    nearby: ["Stellarton", "New Glasgow", "Westville", "Trenton", "Thorburn"],
  },
  {
    slug: "self-storage-near-me",
    title: "Self Storage Near You | Antigonish & Pictou County, NS",
    description: "Find storage close to home in Antigonish, Addington Forks, or Stellarton. Get help with size, compare prices, and keep your belongings nearby with 24/7 access.",
    h1: "Find room for your next step, close to home",
    intro: "Whether you're moving, downsizing, or making space for your business, your belongings can stay within reach. Choose from three locations in Antigonish and Pictou County, each with 24/7 access.",
    sections: [
      {
        heading: "Choose a convenient location",
        body: "For downtown Antigonish or StFX, start with Haley Road. Along Highway 104, consider Addington Forks at Exit 31. For New Glasgow, Westville, or Trenton, compare spaces at Stellarton.",
      },
      {
        heading: "Find room for what you're keeping",
        body: "Use the size guide to estimate the space your belongings need, then compare prices. Haley Road also has climate-controlled units and vehicle parking. Parking and larger units can be limited, so check the listings or ask for help.",
      },
      {
        heading: "Move forward with a clear plan",
        body: "Choose a space, arrange your rental, and follow your confirmation's access instructions. If your preferred size is full, join the waitlist or contact us to talk through other options.",
      },
    ],
    locations: ["haley", "hwy4", "stellarton"],
    nearby: ["Antigonish", "New Glasgow", "Stellarton", "Pictou", "Guysborough", "Sherbrooke"],
  },
];
