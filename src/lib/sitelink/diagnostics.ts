import { AsyncLocalStorage } from "node:async_hooks";
import { log } from "../log";
import { scrubSecrets } from "../redact";

export { scrubSecrets };

/**
 * Categories for one SiteLink SOAP attempt.
 * timeout_headers — aborted before any HTTP status (the ~20s timer, or the
 *   platform, killed the request while it was still waiting).
 * timeout_body — status arrived, then the timer aborted the body read.
 * http_rejection — a non-SOAP HTTP response, including Cloudflare 403 pages.
 * soap_error — SiteLink returned a SOAP fault or a negative Ret_Code.
 * transport — DNS, connection reset, or any other failure before a response.
 */
export type SoapCallCategory = "ok" | "timeout_headers" | "timeout_body" | "http_rejection" | "soap_error" | "transport";

/** Safe to log and return from the probe. No envelope, credentials, or customer fields. */
export type SoapDiagnostic = {
  locationCode: string;
  method: string;
  durationMs: number;
  httpStatus: number | null;
  category: SoapCallCategory;
  cfRay: string | null;
  cloudflareBlock: boolean;
  retCode: number | null;
};

const bucket = new AsyncLocalStorage<SoapDiagnostic[]>();

export function safeCfRay(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 80);
  return /^[A-Za-z0-9_-]{4,80}$/.test(trimmed) ? trimmed : null;
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: string }).name) : "";
  if (name === "AbortError" || name === "TimeoutError") return true;
  const message = err instanceof Error ? err.message : "";
  return /operation was aborted|AbortError/i.test(message);
}

/** Cloudflare's block page and a 403 from the cf-ray / server header. Body text is not retained. */
export function isCloudflareBlock(status: number, server: string | null, cfRay: string | null, bodySample: string): boolean {
  if (/sorry,\s+you have been blocked/i.test(bodySample)) return true;
  if (status === 403 && (cfRay !== null || /cloudflare/i.test(server ?? ""))) return true;
  return false;
}

export function soapDiagnostic(err: unknown): SoapDiagnostic | null {
  if (!err || typeof err !== "object" || !("diagnostic" in err)) return null;
  const value = (err as { diagnostic?: Partial<SoapDiagnostic> }).diagnostic;
  if (!value || typeof value.method !== "string" || typeof value.category !== "string") return null;
  return value as SoapDiagnostic;
}

export function recordSoapDiagnostic(input: SoapDiagnostic): SoapDiagnostic {
  const diagnostic: SoapDiagnostic = {
    locationCode: scrubSecrets(String(input.locationCode)).slice(0, 40),
    method: String(input.method).slice(0, 80),
    durationMs: input.durationMs,
    httpStatus: input.httpStatus,
    category: input.category,
    cfRay: input.cfRay,
    cloudflareBlock: input.cloudflareBlock,
    retCode: input.retCode,
  };
  const emit = diagnostic.category === "ok" ? log.info : log.warn;
  emit("sitelink soap", diagnostic);
  bucket.getStore()?.push(diagnostic);
  return diagnostic;
}

export function attachDiagnostic<T extends Error>(err: T, diagnostic: SoapDiagnostic): T {
  Object.assign(err, { diagnostic });
  return err;
}

/** Collect every SOAP diagnostic emitted while `fn` runs, in call order. */
export async function collectSoapDiagnostics<T>(fn: () => Promise<T>): Promise<{ value: T; diagnostics: SoapDiagnostic[] }> {
  const diagnostics: SoapDiagnostic[] = [];
  const value = await bucket.run(diagnostics, fn);
  return { value, diagnostics };
}
