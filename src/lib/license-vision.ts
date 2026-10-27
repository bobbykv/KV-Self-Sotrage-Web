import "server-only";
import path from "node:path";
import { env } from "./env";
import { log, safeErrorMessage } from "./log";
import { emptyLicenseScan, licenseScanScore, normalizeLicenseScan, parseLicenseOcr, type LicenseScan } from "./license-scan";

const PROMPT =
  'Read this driver\'s license photo. Return JSON only with keys licenseNumber, licenseRegion, addressLine1, city, postalCode. licenseRegion is the 2-letter province or state (NS for Nova Scotia). Nova Scotia license numbers look like XXXXX-00000-00000. Use null when a field is not readable. Do not guess.';

function parseModelJson(text: string): LicenseScan {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return emptyLicenseScan();
  try {
    return normalizeLicenseScan(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return emptyLicenseScan();
  }
}

async function openAiVision(dataUrl: string, key: string, baseUrl: string, model: string): Promise<LicenseScan | null> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseModelJson(body.choices?.[0]?.message?.content ?? "");
}

async function geminiVision(dataUrl: string, key: string): Promise<LicenseScan | null> {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: match[1], data: match[2].replace(/\s/g, "") } }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return parseModelJson(body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "");
}

async function anthropicVision(dataUrl: string, key: string): Promise<LicenseScan | null> {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: match[1], data: match[2].replace(/\s/g, "") } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: { text?: string }[] };
  return parseModelJson(body.content?.map((part) => part.text ?? "").join("") ?? "");
}

async function readWithVision(dataUrl: string): Promise<LicenseScan | null> {
  if (env.appTestMode) return null;
  const attempts: Promise<LicenseScan | null>[] = [];
  if (env.OPENAI_API_KEY) attempts.push(openAiVision(dataUrl, env.OPENAI_API_KEY, "https://api.openai.com/v1", "gpt-4o-mini"));
  else if (env.CHAT_LLM_API_KEY) attempts.push(openAiVision(dataUrl, env.CHAT_LLM_API_KEY, env.CHAT_LLM_BASE_URL, env.CHAT_LLM_MODEL || "gpt-4o-mini"));
  if (env.GEMINI_API_KEY) attempts.push(geminiVision(dataUrl, env.GEMINI_API_KEY));
  if (env.ANTHROPIC_API_KEY) attempts.push(anthropicVision(dataUrl, env.ANTHROPIC_API_KEY));
  for (const attempt of attempts) {
    try {
      const fields = await attempt;
      if (fields && licenseScanScore(fields) > 0) return fields;
    } catch (err) {
      log.warn("license vision failed", { err: safeErrorMessage(err) });
    }
  }
  return null;
}

type OcrWorker = { recognize: (image: string) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };

let workerPromise: Promise<OcrWorker> | null = null;

async function ocrImage(dataUrl: string): Promise<string> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) =>
      createWorker("eng", 1, {
        langPath: path.join(process.cwd(), "node_modules/@tesseract.js-data/eng/4.0.0"),
        gzip: true,
      }),
    ) as Promise<OcrWorker>;
  }
  try {
    const worker = await workerPromise;
    const result = await Promise.race([
      worker.recognize(dataUrl),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("license ocr timed out")), 20000)),
    ]);
    return result.data.text ?? "";
  } catch (err) {
    const pending = workerPromise;
    workerPromise = null;
    void pending?.then((worker) => worker.terminate()).catch(() => undefined);
    throw err;
  }
}

/** Vision when a model key is set, otherwise local Tesseract. Image bytes are not logged or stored. */
export async function extractLicense(dataUrl: string): Promise<{ fields: LicenseScan; source: "vision" | "ocr" | "none" }> {
  const vision = await readWithVision(dataUrl);
  if (vision && licenseScanScore(vision) > 0) return { fields: vision, source: "vision" };
  try {
    const fields = parseLicenseOcr(await ocrImage(dataUrl));
    if (licenseScanScore(fields) > 0) return { fields, source: "ocr" };
  } catch (err) {
    log.warn("license ocr failed", { err: safeErrorMessage(err) });
  }
  return { fields: emptyLicenseScan(), source: "none" };
}
