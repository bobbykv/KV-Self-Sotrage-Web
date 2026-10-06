/**
 * Real customer reviews only — copy them (with permission) from Google.
 * Leave empty rather than inventing testimonials; the block falls back to a
 * "read our Google reviews" link.
 */
export type Review = { name: string; location: string; rating: 1 | 2 | 3 | 4 | 5; text: string; date?: string };

export const REVIEWS: Review[] = [];

export const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/search/?api=1&query=KV+Self+Storage+Antigonish+NS";
