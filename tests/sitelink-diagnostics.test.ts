import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectSoapDiagnostics } from "@/lib/sitelink/diagnostics";
import { invokeLive, SiteLinkError, soapDiagnostic, type LiveConfig } from "@/lib/sitelink/soap";

const PASSWORD = "secret-password-XYZ";
const LICENSE = "LICENSEKEY-XYZ";
const CUSTOMER = "Jane Q Customer";

const cfg: LiveConfig = {
  callCenterEndpoint: "https://api.smdservers.net/CCWs_3.5/CallCenterWs.asmx",
  reportingEndpoint: "https://api.smdservers.net/CCWs_3.5/ReportingWs.asmx",
  corpCode: "CORPCODE-XYZ",
  username: "corpuser",
  licenseKey: LICENSE,
  password: PASSWORD,
  timeoutMs: 40,
};

function diffgram(method: string, rows: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method}Response xmlns="http://tempuri.org/CallCenterWs/CallCenterWs">
      <${method}Result>
        <diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
          <NewDataSet xmlns="">${rows}</NewDataSet>
        </diffgr:diffgram>
      </${method}Result>
    </${method}Response>
  </soap:Body>
</soap:Envelope>`;
}

function abortError(message = "This operation was aborted") {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}

describe("SiteLink SOAP diagnostics", () => {
  const lines: string[] = [];

  beforeEach(() => {
    delete process.env.APP_TEST_MODE;
    process.env.SITELINK_API_PASSWORD = PASSWORD;
    process.env.SITELINK_API_LICENSE_KEY = LICENSE;
    process.env.SITELINK_API_USERNAME = "corpuser";
    process.env.SITELINK_CORP_CODE = cfg.corpCode;
    lines.length = 0;
    vi.spyOn(console, "log").mockImplementation((line) => {
      lines.push(String(line));
    });
    vi.spyOn(console, "warn").mockImplementation((line) => {
      lines.push(String(line));
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("live SiteLink calls are not allowed in tests"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.APP_TEST_MODE;
    delete process.env.SITELINK_API_PASSWORD;
    delete process.env.SITELINK_API_LICENSE_KEY;
    delete process.env.SITELINK_API_USERNAME;
    delete process.env.SITELINK_CORP_CODE;
  });

  function expectNoSecrets(text: string) {
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain(LICENSE);
    expect(text).not.toContain("corpuser:::");
    expect(text).not.toContain(cfg.corpCode);
    expect(text).not.toContain(CUSTOMER);
  }

  it("classifies a timeout before response headers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        const onAbort = () => reject(abortError());
        if (signal?.aborted) onAbort();
        else signal?.addEventListener("abort", onAbort, { once: true });
      });
    });

    const { diagnostics } = await collectSoapDiagnostics(async () => {
      await expect(invokeLive(cfg, "UnitsInformationAvailableUnitsOnly_v2", "L001", { lngLastTimePolled: "0" })).rejects.toThrow(/timed out before response headers/);
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      locationCode: "L001",
      method: "UnitsInformationAvailableUnitsOnly_v2",
      httpStatus: null,
      category: "timeout_headers",
      cfRay: null,
      cloudflareBlock: false,
      retCode: null,
    });
    expect(diagnostics[0]?.durationMs).toBeGreaterThanOrEqual(30);
    expectNoSecrets(lines.join("\n"));
  });

  it("classifies a timeout while reading the body and keeps the status", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      const signal = init?.signal;
      const stream = new ReadableStream({
        start(controller) {
          const fail = () => controller.error(abortError());
          if (signal?.aborted) fail();
          else signal?.addEventListener("abort", fail, { once: true });
        },
      });
      return Promise.resolve(new Response(stream, { status: 200, headers: { "content-type": "text/xml" } }));
    });

    await expect(invokeLive(cfg, "UnitsInformationAvailableUnitsOnly_v2", "L002", {})).rejects.toMatchObject({
      message: expect.stringMatching(/timed out while reading the response body/),
      diagnostic: expect.objectContaining({ category: "timeout_body", httpStatus: 200, locationCode: "L002" }),
    });
    expectNoSecrets(lines.join("\n"));
  });

  it("classifies a Cloudflare block without logging the HTML", async () => {
    const token = "CF-BLOCK-TOKEN-xyz";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(`<html><h1>Sorry, you have been blocked</h1>${token} ${PASSWORD} ${CUSTOMER}</html>`, {
        status: 403,
        headers: { "cf-ray": "8abc123def456-YHZ", server: "cloudflare" },
      }),
    );

    try {
      await invokeLive(cfg, "UnitsInformationAvailableUnitsOnly_v2", "L001", {});
      throw new Error("expected the call to fail");
    } catch (err) {
      const diagnostic = soapDiagnostic(err);
      expect(diagnostic).toMatchObject({
        category: "http_rejection",
        httpStatus: 403,
        cfRay: "8abc123def456-YHZ",
        cloudflareBlock: true,
        locationCode: "L001",
        retCode: null,
      });
      expect((err as Error).message).toContain("HTTP 403");
      expect((err as Error).message).toContain("cf-ray 8abc123def456-YHZ");
      expect((err as Error).message).not.toContain(token);
    }
    const logged = lines.join("\n");
    expect(logged).toContain('"category":"http_rejection"');
    expect(logged).not.toContain(token);
    expectNoSecrets(logged);
  });

  it("classifies a SiteLink SOAP error without logging the Ret_Msg", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        diffgram(
          "UnitsInformationAvailableUnitsOnly_v2",
          `<RT><Ret_Code>-95</Ret_Code><Ret_Msg>denied for ${CUSTOMER} ${PASSWORD}</Ret_Msg></RT>`,
        ),
        { status: 200 },
      ),
    );

    await expect(invokeLive(cfg, "UnitsInformationAvailableUnitsOnly_v2", "L003", {})).rejects.toBeInstanceOf(SiteLinkError);
    const logged = lines.join("\n");
    expect(logged).toContain('"category":"soap_error"');
    expect(logged).toContain('"retCode":-95');
    expect(logged).toContain('"httpStatus":200');
    expectNoSecrets(logged);
  });

  it("logs a successful call with status and duration and no envelope", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(diffgram("SiteInformation", `<RT><Ret_Code>1</Ret_Code><Ret_Msg>ok ${CUSTOMER}</Ret_Msg></RT>`), { status: 200 }),
    );
    await invokeLive(cfg, "SiteInformation", "L002", {});
    const logged = lines.join("\n");
    expect(logged).toContain('"category":"ok"');
    expect(logged).toContain('"httpStatus":200');
    expect(logged).toContain('"locationCode":"L002"');
    expect(logged).toContain('"method":"SiteInformation"');
    expectNoSecrets(logged);
    expect(logged).not.toContain("<sCorpPassword>");
    expect(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body)).toContain(PASSWORD);
  });
});
