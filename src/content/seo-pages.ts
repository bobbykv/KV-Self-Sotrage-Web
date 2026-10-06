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

/** Unique copy per target query. Keep claims to what's in location-seed.json. */
export const SEO_PAGES: SeoPage[] = [
  {
    slug: "self-storage-antigonish",
    title: "Self Storage Antigonish, NS — Live Prices & 24/7 Access",
    description: "Self storage in Antigonish, NS at 20 Haley Road (near downtown) and 2784 NS-4 at Exit 31. Climate-controlled units, RV & boat parking, 24/7 access. See live prices.",
    h1: "Self storage in Antigonish",
    intro:
      "KV Self Storage has two Antigonish-area locations: Haley Road, less than a kilometre from downtown, and Addington Forks on Highway 4 at Exit 31. Both are open 24/7, and you can see real prices and hold a unit online.",
    sections: [
      {
        heading: "Close to downtown and StFX",
        body: "Our Haley Road site is minutes from Main Street and the StFX campus — handy for students storing over the summer, families between homes, and local businesses that need overflow space. It's also where you'll find our climate-controlled units and indoor and outdoor RV, boat and vehicle parking.",
      },
      {
        heading: "Highway access at Exit 31",
        body: "If you're coming from Lower West River, Salt Springs or anywhere along the 104, our Addington Forks location at 2784 NS-4 is right off Exit 31. It features Noke smart-lock access so you can unlock from your phone.",
      },
      {
        heading: "Straightforward pricing",
        body: "Prices on our website come straight from our booking system and refresh about every 30 minutes. At checkout every line is listed — rent, any admin fee, and HST on its own line — before you pay anything.",
      },
    ],
    locations: ["haley", "hwy4"],
    nearby: ["Antigonish", "St. Andrews", "Lower South River", "Addington Forks", "Lower West River", "Heatherton"],
  },
  {
    slug: "self-storage-new-glasgow",
    title: "Self Storage near New Glasgow, NS — KV Stellarton",
    description: "Looking for self storage near New Glasgow? KV Self Storage at 30 Heritage Ave, Stellarton is minutes away. 24/7 access, Noke smart locks, live online prices.",
    h1: "Self storage near New Glasgow",
    intro:
      "Our newest facility is at 30 Heritage Avenue in Stellarton — a short drive from downtown New Glasgow, Westville and Trenton. It's open 24/7 and uses Noke smart-lock access.",
    sections: [
      {
        heading: "Minutes from New Glasgow",
        body: "Whether you're downsizing in New Glasgow, renovating in Trenton or moving into the area, our Stellarton site is close enough to make quick trips easy — and with 24/7 access you can come and go on your schedule.",
      },
      {
        heading: "Unlock from your phone",
        body: "Stellarton is one of our two Noke smart-lock locations, so tenants can unlock remotely from the Noke app — no fumbling with keys in the rain.",
      },
      {
        heading: "Book online in a few minutes",
        body: "See what's open now, hold a unit for 20 minutes while you check out, and see the full total including HST before you pay. Prefer to talk? We're a local business and we answer the phone.",
      },
    ],
    locations: ["stellarton"],
    nearby: ["New Glasgow", "Stellarton", "Westville", "Trenton", "Pictou", "Plymouth"],
  },
  {
    slug: "self-storage-stellarton",
    title: "Self Storage Stellarton, NS — 30 Heritage Ave",
    description: "KV Self Storage Stellarton at 30 Heritage Avenue: drive-up storage units, 24/7 access, Noke smart-lock remote unlock and live online prices.",
    h1: "Self storage in Stellarton",
    intro: "KV Self Storage Stellarton is at 30 Heritage Avenue. It's our newest location — gated, camera-monitored and open around the clock.",
    sections: [
      {
        heading: "A newer facility in Pictou County",
        body: "Stellarton has gated, coded entry and camera surveillance. Office hours are Monday to Friday, 8:00am to 4:30pm, and access is 24/7.",
      },
      {
        heading: "Noke smart-lock access",
        body: "Stellarton uses Noke smart locks for remote unlock from your phone. Once you've moved in, the office will get you set up on the app.",
      },
      {
        heading: "Honest prices, no surprises",
        body: "Our website shows live sizes and monthly rates. At checkout you'll see every charge, including HST as its own line, before paying. Refunds are handled personally by the owner.",
      },
    ],
    locations: ["stellarton"],
    nearby: ["Stellarton", "New Glasgow", "Westville", "Trenton", "Thorburn"],
  },
  {
    slug: "self-storage-near-me",
    title: "Self Storage Near Me — Antigonish & Pictou County, NS",
    description: "Find self storage near you in northeastern Nova Scotia: KV Self Storage in Antigonish (Haley Rd and Hwy 4 Exit 31) and Stellarton. Live availability and 24/7 access.",
    h1: "Self storage near you in northeastern Nova Scotia",
    intro:
      "KV Self Storage serves Antigonish County, Pictou County and Guysborough from three locations. Pick the one closest to you — every site has 24/7 access and live online prices.",
    sections: [
      {
        heading: "Which location is closest?",
        body: "In or near the Town of Antigonish, Haley Road is closest. Along the 104 between Antigonish and Pictou County, Addington Forks at Exit 31 is easiest. In New Glasgow, Stellarton, Westville or Trenton, choose Stellarton.",
      },
      {
        heading: "What you'll find",
        body: "A range of unit sizes at all three; climate-controlled units and RV/boat parking at Haley Road; Noke smart-lock remote unlock at Addington Forks and Stellarton.",
      },
      {
        heading: "Rent from your phone",
        body: "Browse live availability, hold a unit for 20 minutes, and see the full total including HST up front. Need something that's full? Join the list and we'll call you when it opens.",
      },
    ],
    locations: ["haley", "hwy4", "stellarton"],
    nearby: ["Antigonish", "New Glasgow", "Stellarton", "Pictou", "Guysborough", "Sherbrooke"],
  },
];
