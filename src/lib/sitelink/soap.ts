import "server-only";
import contractJson from "./contract.generated.json";
import { parseDataSetResponse, str, type DataSet } from "./dataset";
import { redactString } from "../redact";

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
  password: string;
  timeoutMs: number;
};

export async function invokeLive(cfg: LiveConfig, method: SiteLinkMethod, locationCode: string, args: Args): Promise<DataSet> {
  const sig = CONTRACT[method];
  const auth = {
    sCorpCode: cfg.corpCode,
    sLocationCode: locationCode,
    sLocationCodesCommaDelimited: locationCode,
    sCorpUserName: cfg.username,
    sCorpPassword: cfg.password,
  };
  const envelope = buildEnvelope(method, auth, args);
  const endpoint = sig.service === "reporting" ? cfg.reportingEndpoint : cfg.callCenterEndpoint;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  let text: string;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${sig.namespace}/${method}"` },
      body: envelope,
      signal: controller.signal,
      cache: "no-store",
    });
    text = await res.text();
    if (!res.ok && !text.includes("Fault")) throw new Error(`${method}: HTTP ${res.status}`);
  } catch (err) {
    throw new Error(redactString(`${method}: transport error ${(err as Error).message}`));
  } finally {
    clearTimeout(timer);
  }
  const data = parseDataSetResponse(text, method);
  assertOk(method, data);
  return data;
}

/** SiteLink signals errors with a negative Ret_Code in the RT table. */
export function assertOk(method: string, data: DataSet) {
  const rt = data.RT?.[0];
  if (!rt) return;
  const code = Number(str(rt, "Ret_Code"));
  if (Number.isFinite(code) && code < 0) throw new SiteLinkError(method, code, redactString(str(rt, "Ret_Msg") || "unknown error"));
}

/** The positive Ret_Code is the new record id for create methods (tenant, reservation...). */
export function retCode(data: DataSet): number {
  return Number(str(data.RT?.[0], "Ret_Code")) || 0;
}
