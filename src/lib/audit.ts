import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { redact } from "./redact";
import { log } from "./log";

export async function audit(actor: string, action: string, target?: string, meta?: Record<string, unknown>) {
  try {
    await db.auditLog.create({
      data: { actor, action, target, meta: meta ? (redact(meta) as Prisma.InputJsonValue) : undefined },
    });
  } catch (err) {
    log.error("audit write failed", { action, err });
  }
}
