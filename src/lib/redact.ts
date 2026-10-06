/**
 * Payment-adjacent redaction. Applied to every log line, every stored error
 * string and every SOAP envelope we might ever print. Card data must never
 * reach our DB, logs or error tracking (PCI posture in docs/ARCHITECTURE.md).
 */

const SENSITIVE_KEYS =
  /(card|cc|cvv|cvc|pan|expir|track2|routing|aba|account.?num|password|passwd|secret|token|sCorpPassword|sTenantPassword|authorization)/i;

const SOAP_SENSITIVE_ELEMENTS = [
  "sCreditCardNumber",
  "sCreditCardNum",
  "sCreditCardCVV",
  "sCCTrack2",
  "dExpirationDate",
  "sABARoutingNum",
  "sAccountNum",
  "sCorpPassword",
  "sCorpUserName",
  "sTenantPassword",
  "sWebPassword",
  "sUsagePassword",
];

// 12–19 digit runs, optionally separated by spaces/dashes: treat as a PAN.
const PAN_PATTERN = /\b(?:\d[ -]?){12,19}\b/g;

export function redactString(input: string): string {
  let out = input;
  for (const el of SOAP_SENSITIVE_ELEMENTS) {
    out = out.replace(new RegExp(`<${el}>[\\s\\S]*?</${el}>`, "g"), `<${el}>[REDACTED]</${el}>`);
  }
  return out.replace(PAN_PATTERN, "[REDACTED-PAN]");
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.test(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}
