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
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
};

/** Location claims follow location-seed.json. Copy source: docs/WEBSITE_COPY.md */
export const SEO_PAGES: SeoPage[] = [
  {
    slug: "self-storage-antigonish",
    title: "Self Storage in Antigonish | Haley Road & Addington Forks | KV",
    description: "Compare self storage in Antigonish at Haley Road and Addington Forks. Climate-controlled units and vehicle parking at Haley Road. 24/7 access.",
    h1: "Self storage in Antigonish",
    intro: "Moving, downsizing or storing between terms at StFX? Compare units at Haley Road and Addington Forks. See the price before you book.",
    sections: [
      {
        heading: "Close to StFX",
        body: "20 Haley Road is close to StFX and downtown Antigonish. Choose climate-controlled units or check RV, boat and vehicle parking.",
      },
      {
        heading: "Storage at Exit 31",
        body: "Find us at 2784 NS-4 in Addington Forks. This location serves Lower West River, Salt Springs and nearby communities. Units use Nokē app unlock.",
      },
      {
        heading: "Know what you're paying",
        body: "Compare monthly rent. Checkout shows fees and HST up front. Both locations have gated coded entry, cameras and 24/7 access.",
      },
    ],
    locations: ["haley", "hwy4"],
    nearby: ["Antigonish", "StFX", "Addington Forks", "Lower West River", "Salt Springs"],
    primaryCta: { href: "/units?location=haley", label: "See Antigonish units & prices" },
    secondaryCta: { href: "tel:+19028673779", label: "Call (902) 867-3779" },
  },
  {
    slug: "self-storage-new-glasgow",
    title: "Self Storage Near New Glasgow | Stellarton | KV Self Storage",
    description: "Need storage near New Glasgow? Compare units at 30 Heritage Ave in Stellarton. Nokē app unlock, gated entry, cameras and 24/7 access.",
    h1: "Self storage near New Glasgow",
    intro: "Store your furniture, boxes or business stock at 30 Heritage Ave in Stellarton. Check the sizes and prices. Choose what fits.",
    sections: [
      {
        heading: "Storage in Stellarton",
        body: "Our Heritage Avenue location serves New Glasgow, Stellarton, Westville and Trenton. Check the directions before you head over.",
      },
      {
        heading: "Get to your things 24/7",
        body: "The location has gated coded entry and cameras. Unlock your unit with the Nokē app after your rental and access setup are complete.",
      },
      {
        heading: "Check the full cost",
        body: "Compare monthly rent online. Checkout shows fees and HST before you pay. Ask us if you need help picking a size.",
      },
    ],
    locations: ["stellarton"],
    nearby: ["New Glasgow", "Stellarton", "Westville", "Trenton"],
    primaryCta: { href: "/units?location=stellarton", label: "See Stellarton units & prices" },
    secondaryCta: { href: "tel:+19028673779", label: "Call (902) 867-3779" },
  },
  {
    slug: "self-storage-stellarton",
    title: "Self Storage in Stellarton | 30 Heritage Ave | KV Self Storage",
    description: "Self storage at 30 Heritage Ave in Stellarton. Nokē app unlock, gated entry, cameras and 24/7 access. Compare unit sizes and prices.",
    h1: "Self storage in Stellarton",
    intro: "Need space for furniture, boxes or business stock? Find us at 30 Heritage Ave. Compare sizes and prices before you book.",
    sections: [
      {
        heading: "Store near home or work",
        body: "Our Heritage Avenue location serves Stellarton, New Glasgow, Westville and Trenton.",
      },
      {
        heading: "Use your phone to unlock",
        body: "Stellarton units use the Nokē app. Finish your rental and follow your setup instructions before moving in. Gated coded entry, cameras and 24/7 access are included at this location.",
      },
      {
        heading: "Choose the size you need",
        body: "Use the size finder for a starting estimate. Compare monthly rent. Checkout shows fees and HST before you pay.",
      },
    ],
    locations: ["stellarton"],
    nearby: ["Stellarton", "New Glasgow", "Westville", "Trenton"],
    primaryCta: { href: "/units?location=stellarton", label: "See Stellarton units & prices" },
    secondaryCta: { href: "tel:+19028673779", label: "Call (902) 867-3779" },
  },
  {
    slug: "self-storage-near-me",
    title: "Self Storage in Antigonish & Stellarton | Locations Near You | KV",
    description: "Find KV Self Storage in Antigonish, Addington Forks and Stellarton. Compare unit sizes, locations and prices. All three offer 24/7 access.",
    h1: "Self storage in Antigonish and Stellarton",
    intro: "Choose from three locations. Compare the sizes and prices, then book the unit that works for you.",
    sections: [
      {
        heading: "Antigonish: Haley Road",
        body: "20 Haley Road. Close to StFX. Climate-controlled units and RV, boat and vehicle parking.",
      },
      {
        heading: "Addington Forks: Exit 31",
        body: "2784 NS-4. Convenient for Lower West River and Salt Springs. Nokē app unlock.",
      },
      {
        heading: "Stellarton: Heritage Avenue",
        body: "30 Heritage Ave. Serving Stellarton, New Glasgow, Westville and Trenton. Nokē app unlock.",
      },
      {
        heading: "At all three locations",
        body: "Gated coded entry. Camera surveillance. 24/7 access.",
      },
    ],
    locations: ["haley", "hwy4", "stellarton"],
    nearby: ["Antigonish", "Addington Forks", "Stellarton", "New Glasgow"],
    primaryCta: { href: "/units", label: "See units & prices" },
    secondaryCta: { href: "/locations", label: "Find a location" },
  },
];
