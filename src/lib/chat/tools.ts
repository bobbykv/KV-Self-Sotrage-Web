import "server-only";
import { BRAND, getLocation, isLocationKey, type LocationKey } from "@/config/locations";
import { filterGroups, formatSize, fullTypes, groupUnits, type SizeCategory } from "../catalog";
import { getFaq, searchFaq } from "../faq";
import { getInventory } from "../inventory";
import { captureLead, type LeadInput } from "../leads";
import type { AgentChannel } from "../brain";

export type ToolName = "search_units" | "get_faq" | "capture_lead" | "handoff_to_human";
export const TOOL_NAMES: ToolName[] = ["search_units", "get_faq", "capture_lead", "handoff_to_human"];

type Args = Record<string, unknown>;

const CATS: SizeCategory[] = ["small", "medium", "large", "parking"];

/** Reads ONLY the cached inventory — a chat turn never triggers a SiteLink SOAP call. */
export async function searchUnits(args: Args) {
  const inv = await getInventory();
  const location = isLocationKey(args.location) ? args.location : undefined;
  const category = CATS.includes(args.size_category as SizeCategory) ? (args.size_category as SizeCategory) : undefined;
  const groups = groupUnits(inv.flatMap((l) => l.units));
  const matches = filterGroups(groups, {
    location,
    category,
    climate: args.climate_controlled === true ? true : undefined,
    vehicle: args.vehicle_parking === true ? true : category === "parking" ? true : undefined,
    maxRate: typeof args.max_monthly_price === "number" ? args.max_monthly_price : undefined,
  });
  const full = fullTypes(
    inv.flatMap((l) => l.priceList),
    groups,
  ).filter((p) => !location || p.locationKey === location);
  const asOf = inv
    .map((l) => l.refreshedAt)
    .filter(Boolean)
    .sort()[0];
  return {
    as_of: asOf ?? null,
    available: matches.slice(0, 8).map((g) => ({
      location: g.locationKey,
      location_name: getLocation(g.locationKey).shortName,
      type: g.typeName,
      size: `${g.widthFt}x${g.lengthFt}`,
      size_label: formatSize(g.widthFt, g.lengthFt),
      monthly_price: g.fromRate,
      available_count: g.available,
      climate_controlled: g.climate,
      vehicle: g.vehicle,
      hold_url: `/units/${g.locationKey}/${g.bestUnitId}`,
    })),
    total_matches: matches.length,
    currently_full: full.slice(0, 6).map((p) => ({
      location: p.locationKey,
      type: p.typeName,
      size: `${p.widthFt}x${p.lengthFt}`,
    })),
  };
}

export async function getFaqAnswer(args: Args) {
  const hits = searchFaq(await getFaq(), String(args.query ?? ""));
  return { results: hits.map((h) => ({ question: h.question, answer: h.answer, url: `/faq#${h.id}` })) };
}

export async function runTool(name: ToolName, args: Args, channel: AgentChannel) {
  switch (name) {
    case "search_units":
      return searchUnits(args);
    case "get_faq":
      return getFaqAnswer(args);
    case "capture_lead": {
      const lead: LeadInput = {
        channel: channel === "website_chat" ? "website_chat" : channel,
        reason: (["unavailable_unit", "waitlist", "contact_request", "human_handoff"].includes(String(args.reason)) ? args.reason : "contact_request") as LeadInput["reason"],
        name: String(args.name ?? "").slice(0, 120),
        phone: args.phone ? String(args.phone) : undefined,
        email: args.email ? String(args.email) : undefined,
        locationKey: isLocationKey(args.location) ? (args.location as LocationKey) : undefined,
        unitType: args.unit_type ? String(args.unit_type) : undefined,
        unitSize: args.unit_size ? String(args.unit_size) : undefined,
        notes: args.notes ? String(args.notes) : undefined,
        externalId: args.external_id ? String(args.external_id).slice(0, 200) : undefined,
      };
      try {
        const saved = await captureLead(lead);
        return { ok: true, lead_id: saved.id, message: "Lead saved and sent to GoHighLevel. Staff will follow up." };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Please add your name and a phone number or email so we can follow up." };
      }
    }
    case "handoff_to_human":
      return {
        phone: BRAND.phone,
        email: BRAND.email,
        office_hours: "Mon–Fri, roughly 8:00/8:30am–4:30pm depending on location",
        message: "Offer the phone number and offer to take a callback request with capture_lead (reason human_handoff).",
      };
  }
}
