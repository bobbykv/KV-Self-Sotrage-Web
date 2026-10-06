import "server-only";
/**
 * Loads and saves the SiteLink mock facility state from Postgres so fake
 * rentals, tenants and ledgers survive Vercel serverless cold starts.
 */
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { log } from "../log";

const STATE_ID = "default";

export async function loadMockPayload<T>(): Promise<T | null> {
  try {
    const row = await db.mockSiteLinkState.findUnique({ where: { id: STATE_ID } });
    return (row?.payload as T) ?? null;
  } catch (err) {
    log.warn("mock state load failed; using memory only", { err });
    return null;
  }
}

export async function saveMockPayload(payload: unknown): Promise<void> {
  try {
    await db.mockSiteLinkState.upsert({
      where: { id: STATE_ID },
      create: { id: STATE_ID, payload: payload as Prisma.InputJsonValue },
      update: { payload: payload as Prisma.InputJsonValue },
    });
  } catch (err) {
    log.warn("mock state save failed", { err });
  }
}
