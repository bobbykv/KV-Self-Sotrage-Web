import "server-only";
import contractJson from "./contract.generated.json";
import { parseDataSetResponse, str, type DataSet } from "./dataset";
import {
  attachDiagnostic,
  isAbortError,
  isCloudflareBlock,
  recordSoapDiagnostic,
  safeCfRay,
  soapDiagnostic,
  type SoapDiagnostic,
} from "./diagnostics";
import { SITELINK_USER_AGENT, siteLinkCorpUserName } from "./http";
import { scrubSecrets } from "../redact";
import { isAppTestMode } from "../test-mode";

export { soapDiagnostic };
export type { SoapDiagnostic };

export { SITELINK_USER_AGENT, siteLinkCorpUserName };

type Param = { name: string; type: string };
type MethodSig = { service: "callcenter" | "reporting"; namespace: string; params: Param[] };

export const CONTRACT = contractJson as Record<string, MethodSig>;
export type SiteLinkMethod = keyof typeof contractJson;

/** Injected automatically; wrappers never pass these. */
const AUTH_PARAMS = new Set(["sCorpCode", "sLocationCode", "sLocationCodesCommaDelimited", "sCorpUserName", "sCorpPassword"]);

export type Args = Record<string, string | number | boolean | Date | null | undefined>;

export class SiteLinkError extends Error {
  constructor(
    public method: string,
    public code: number,
    message: string,
  ) {
    super(`${method} failed (Ret_Code ${code}): ${message}`);
    this.name = "SiteLinkError";
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/**
 * SiteLink expects facility-local wall-clock times without an offset.
 * All three KV facilities are in Atlantic time. VERIFY with SiteLink support
 * that dExpires is interpreted in facility time (see docs/SITELINK.md).
 */
export function toSiteLinkDateTime(d: Date, timeZone = process.env.SITELINK_TIMEZONE ?? "America/Halifax"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

function serialize(type: string, value: Args[string]): string {
  if (value === null || value === undefined) {
    switch (type) {
      case "int":
      case "long":
      case "decimal":
      case "double":
        return "0";
      case "boolean":
        return "false";
      case "dateTime":
        return toSiteLinkDateTime(new Date());
      default:
        return "";
    }
  }
  if (value instanceof Date) return toSiteLinkDateTime(value);
  if (type === "decimal" && typeof value === "number") return value.toFixed(2);
  return String(value);
}

export function buildEnvelope(method: SiteLinkMethod, auth: Record<string, string>, args: Args): string {
  const sig = CONTRACT[method];
  if (!sig) throw new Error(`SiteLink method ${method} is not in the contract`);
  const known = new Set(sig.params.map((p) => p.name));
  for (const key of Object.keys(args)) {
    if (!known.has(key)) throw new Error(`${method}: unknown parameter ${key} (not in live WSDL contract)`);
    if (AUTH_PARAMS.has(key)) throw new Error(`${method}: auth parameter ${key} must not be passed by callers`);
  }
  const body = sig.params
    .map((p) => {
      const v = AUTH_PARAMS.has(p.name) ? auth[p.name] ?? "" : serialize(p.type, args[p.name]);
      return `<${p.name}>${escapeXml(String(v))}</${p.name}>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">` +
    `<soap:Body><${method} xmlns="${sig.namespace}">${body}</${method}></soap:Body></soap:Envelope>`
  );
}

export type LiveConfig = {
  callCenterEndpoint: string;
  reportingEndpoint: string;
  corpCode: string;
  username: string;
  /** Optional. Appended as `username:::key` when username does not already contain `:::`. */
  licenseKey?: string | null;
  password: string;
  timeoutMs: number;
};

function finish(diagnostic: SoapDiagnostic, err?: Error): never {
  const recorded = recordSoapDiagnostic(diagnostic);
  if (!err) throw new Error(`${diagnostic.method}: ${diagnostic.category}`);
  throw attachDiagnostic(err, recorded);
}

export async function invokeLive(cfg: LiveConfig, method: SiteLinkMethod, locationCode: string, args: Args): Promise<DataSet> {
  if (isAppTestMode()) {
    throw new Error(`${method}: live SiteLink calls are blocked in APP_TEST_MODE`);
  }
  const sig = CONTRACT[method];
  const auth = {
    sCorpCode: cfg.corpCode,
    sLocationCode: locationCode,
    sLocationCodesCommaDelimited: locationCode,
    sCorpUserName: siteLinkCorpUserName(cfg.username, cfg.licenseKey),
    sCorpPassword: cfg.password,
  };
  const envelope = buildEnvelope(method, auth, args);
  const endpoint = sig.service === "reporting" ? cfg.reportingEndpoint : cfg.callCenterEndpoint;
  const controller = new AbortController();
  const started = Date.now();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  let phase: "headers" | "body" = "headers";
  let httpStatus: number | null = null;
  let cfRay: string | null = null;
  const base = (partial: Pick<SoapDiagnostic, "category" | "cloudflareBlock" | "retCode"> & { httpStatus?: number | null }): SoapDiagnostic => ({
    locationCode,
    method,
    durationMs: Date.now() - started,
    httpStatus: partial.httpStatus ?? httpStatus,
    category: partial.category,
    cfRay,
    cloudflareBlock: partial.cloudflareBlock,
    retCode: partial.retCode,
  });
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${sig.namespace}/${method}"`,
        // Required. api.smdservers.net answers 403 when User-Agent is missing.
        "User-Agent": SITELINK_USER_AGENT,
      },
      body: envelope,
      signal: controller.signal,
      cache: "no-store",
    });
    phase = "body";
    httpStatus = res.status;
    cfRay = safeCfRay(res.headers.get("cf-ray"));
    const text = await res.text();
    const cloudflareBlock = isCloudflareBlock(res.status, res.headers.get("server"), cfRay, text.slice(0, 2000));
    const soapFault = /<(?:\w+:)?Fault\b/.test(text);
    if (!res.ok && !soapFault) {
      const detail = cloudflareBlock ? " blocked" : "";
      const ray = cfRay ? ` cf-ray ${cfRay}` : "";
      finish(base({ category: "http_rejection", cloudflareBlock, retCode: null }), new Error(scrubSecrets(`${method}: HTTP ${res.status}${detail}${ray}`)));
    }
    let data: DataSet;
    try {
      data = parseDataSetResponse(text, method);
      assertOk(method, data);
    } catch (err) {
      const retCode = err instanceof SiteLinkError ? err.code : null;
      const wrapped = err instanceof Error ? err : new Error(scrubSecrets(String(err)));
      finish(base({ category: "soap_error", cloudflareBlock: false, retCode }), wrapped);
    }
    const rt = Number(str(data.RT?.[0], "Ret_Code"));
    recordSoapDiagnostic(base({ category: "ok", cloudflareBlock: false, retCode: Number.isFinite(rt) ? rt : null }));
    return data;
  } catch (err) {
    if (soapDiagnostic(err)) throw err;
    const aborted = isAbortError(err);
    const category = aborted ? (phase === "headers" ? "timeout_headers" : "timeout_body") : "transport";
    const message = aborted
      ? `${method}: ${category === "timeout_headers" ? "timed out before response headers" : "timed out while reading the response body"}`
      : `${method}: transport error ${scrubSecrets(err instanceof Error ? err.message : "unknown").slice(0, 180)}`;
    finish(base({ category, cloudflareBlock: false, retCode: null }), new Error(message));
  } finally {
    clearTimeout(timer);
  }
}

/** SiteLink signals errors with a negative Ret_Code in the RT table. */
export function assertOk(method: string, data: DataSet) {
  const rt = data.RT?.[0];
  if (!rt) return;
  const code = Number(str(rt, "Ret_Code"));
  if (Number.isFinite(code) && code < 0) throw new SiteLinkError(method, code, scrubSecrets(str(rt, "Ret_Msg") || "unknown error"));
}

/** The positive Ret_Code is the new record id for create methods (tenant, reservation...). */
export function retCode(data: DataSet): number {
  return Number(str(data.RT?.[0], "Ret_Code")) || 0;
}
