import { beforeEach, describe, expect, it, vi } from "vitest";

const { ghlEnv } = vi.hoisted(() => ({
  ghlEnv: {
    GHL_API_KEY: "test-key" as string | undefined,
    GHL_LOCATION_ID: "nGDJgf5wtNXdc5NWsm0z" as string | undefined,
    GHL_STORAGE_PIPELINE_ID: undefined as string | undefined,
    GHL_STORAGE_STAGE_ID: undefined as string | undefined,
  },
}));

vi.mock("@/lib/env", () => ({ env: ghlEnv }));

import { ghlOpportunityName, postGhlStorageOpportunity, resolveGhlStoragePipelineId, resolveGhlStorageStageId } from "@/lib/ghl";

const KV_LOCATION = "nGDJgf5wtNXdc5NWsm0z";
const KV_PIPELINE = "LjSbI4Go4wJrqD2dEqdz";
const KV_STAGE = "8a2cbc31-d9a5-411a-b89c-184cb31b4262";

describe("GoHighLevel storage opportunity", () => {
  beforeEach(() => {
    ghlEnv.GHL_API_KEY = "test-key";
    ghlEnv.GHL_LOCATION_ID = KV_LOCATION;
    ghlEnv.GHL_STORAGE_PIPELINE_ID = undefined;
    ghlEnv.GHL_STORAGE_STAGE_ID = undefined;
    vi.restoreAllMocks();
  });

  it("defaults the KV Storage pipeline and New Inquiry stage", () => {
    expect(resolveGhlStoragePipelineId(KV_LOCATION, undefined)).toBe(KV_PIPELINE);
    expect(resolveGhlStoragePipelineId(KV_LOCATION, "  ")).toBe(KV_PIPELINE);
    expect(resolveGhlStoragePipelineId("other-location", undefined)).toBeUndefined();
    expect(resolveGhlStoragePipelineId("other-location", "pipe-explicit")).toBe("pipe-explicit");
    expect(resolveGhlStorageStageId(undefined)).toBe(KV_STAGE);
    expect(resolveGhlStorageStageId(" stage-explicit ")).toBe("stage-explicit");
  });

  it("names the opportunity from size, type, then a storage inquiry", () => {
    expect(ghlOpportunityName({ name: "Jane Doe", unitSize: "10x10", unitType: "Drive-up", preferredLocation: "Haley Road" })).toBe(
      "Jane Doe — 10x10 (Haley Road)",
    );
    expect(ghlOpportunityName({ name: "Jane Doe", unitType: "Drive-up", preferredLocation: "Stellarton" })).toBe("Jane Doe — Drive-up (Stellarton)");
    expect(ghlOpportunityName({ name: "Jane Doe", preferredLocation: "Any" })).toBe("Jane Doe — Storage Inquiry (Any)");
  });

  it("upserts into Storage → New Inquiry after the contact id is known", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await postGhlStorageOpportunity("contact_1", { name: "Jane Doe", unitSize: "5x10", preferredLocation: "Addington Forks" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://services.leadconnectorhq.com/opportunities/upsert");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers.Version).toBe("2021-07-28");
    expect(JSON.parse(String(init?.body))).toEqual({
      locationId: KV_LOCATION,
      pipelineId: KV_PIPELINE,
      pipelineStageId: KV_STAGE,
      contactId: "contact_1",
      name: "Jane Doe — 5x10 (Addington Forks)",
      status: "open",
    });
  });

  it("uses explicit pipeline and stage ids when set", async () => {
    ghlEnv.GHL_LOCATION_ID = "other-location";
    ghlEnv.GHL_STORAGE_PIPELINE_ID = "pipe-explicit";
    ghlEnv.GHL_STORAGE_STAGE_ID = "stage-explicit";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 201 }));
    await postGhlStorageOpportunity("contact_2", { name: "Sam", unitType: "Outdoor Car Winter Storage", preferredLocation: "Stellarton" });
    expect(JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))).toMatchObject({
      locationId: "other-location",
      pipelineId: "pipe-explicit",
      pipelineStageId: "stage-explicit",
      name: "Sam — Outdoor Car Winter Storage (Stellarton)",
      status: "open",
    });
  });

  it("skips the opportunity when this location has no pipeline", async () => {
    ghlEnv.GHL_LOCATION_ID = "other-location";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await postGhlStorageOpportunity("contact_3", { name: "Sam", preferredLocation: "Any" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores a failed opportunity upsert", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(postGhlStorageOpportunity("contact_4", { name: "Sam", preferredLocation: "Any" })).resolves.toBeUndefined();
  });
});
