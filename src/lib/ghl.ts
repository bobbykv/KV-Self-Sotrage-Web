import "server-only";
import { env } from "./env";

/** KV Self Storage location in GoHighLevel. */
export const KV_GHL_LOCATION_ID = "nGDJgf5wtNXdc5NWsm0z";
/** Storage pipeline. Used when GHL_STORAGE_PIPELINE_ID is unset and the location is KV. */
export const KV_GHL_STORAGE_PIPELINE_ID = "LjSbI4Go4wJrqD2dEqdz";
/** Storage pipeline → New Inquiry. Default for GHL_STORAGE_STAGE_ID. */
export const KV_GHL_STORAGE_STAGE_ID = "8a2cbc31-d9a5-411a-b89c-184cb31b4262";

export function resolveGhlStoragePipelineId(locationId: string | undefined, configured?: string | null): string | undefined {
  const explicit = configured?.trim();
  if (explicit) return explicit;
  if (locationId === KV_GHL_LOCATION_ID) return KV_GHL_STORAGE_PIPELINE_ID;
  return undefined;
}

export function resolveGhlStorageStageId(configured?: string | null): string {
  return configured?.trim() || KV_GHL_STORAGE_STAGE_ID;
}

export function ghlOpportunityName(payload: {
  name: string;
  unitSize?: string | null;
  unitType?: string | null;
  preferredLocation?: string | null;
}): string {
  const what = payload.unitSize || payload.unitType || "Storage Inquiry";
  const where = payload.preferredLocation || "Any";
  return `${payload.name} — ${what} (${where})`;
}

/**
 * Best-effort Storage → New Inquiry opportunity. Network failures are ignored
 * so a pipeline miss never fails the contact upsert that already succeeded.
 */
export async function postGhlStorageOpportunity(contactId: string, payload: {
  name: string;
  unitSize?: string | null;
  unitType?: string | null;
  preferredLocation?: string | null;
}): Promise<void> {
  if (!env.GHL_API_KEY || !env.GHL_LOCATION_ID) return;
  const pipelineId = resolveGhlStoragePipelineId(env.GHL_LOCATION_ID, env.GHL_STORAGE_PIPELINE_ID);
  if (!pipelineId) return;
  const pipelineStageId = resolveGhlStorageStageId(env.GHL_STORAGE_STAGE_ID);
  await fetch("https://services.leadconnectorhq.com/opportunities/upsert", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GHL_API_KEY}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      locationId: env.GHL_LOCATION_ID,
      pipelineId,
      pipelineStageId,
      contactId,
      name: ghlOpportunityName(payload),
      status: "open",
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => undefined);
}
