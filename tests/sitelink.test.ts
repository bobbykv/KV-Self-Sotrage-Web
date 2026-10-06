import { describe, expect, it } from "vitest";
import { parseDataSetResponse, SiteLinkSoapFault } from "@/lib/sitelink/dataset";
import { mapMoveInCost } from "@/lib/sitelink/mappers";
import { buildEnvelope, CONTRACT, retCode, toSiteLinkDateTime } from "@/lib/sitelink/soap";

const AUTH = { sCorpCode: "CORP", sLocationCode: "L001", sCorpUserName: "user", sCorpPassword: "p@ss<word>" };

function diffgram(method: string, rows: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method}Response xmlns="http://tempuri.org/CallCenterWs/CallCenterWs">
      <${method}Result>
        <xs:schema id="NewDataSet" xmlns:xs="http://www.w3.org/2001/XMLSchema"></xs:schema>
        <diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
          <NewDataSet xmlns="">${rows}</NewDataSet>
        </diffgr:diffgram>
      </${method}Result>
    </${method}Response>
  </soap:Body>
</soap:Envelope>`;
}

describe("DataSet adapter", () => {
  it("flattens diffgram tables into rows", () => {
    const xml = diffgram(
      "UnitsInformationAvailableUnitsOnly_v2",
      `<RT diffgr:id="RT1"><Ret_Code>1</Ret_Code><Ret_Msg /></RT>
       <Table diffgr:id="Table1"><UnitID>101</UnitID><sUnitName>A01</sUnitName><dcStdRate>99.00</dcStdRate></Table>
       <Table diffgr:id="Table2"><UnitID>102</UnitID><sUnitName>A02</sUnitName><dcStdRate>129.00</dcStdRate></Table>`,
    );
    const ds = parseDataSetResponse(xml, "UnitsInformationAvailableUnitsOnly_v2");
    expect(ds.Table).toHaveLength(2);
    expect(ds.Table[1]).toMatchObject({ UnitID: "102", sUnitName: "A02", dcStdRate: "129.00" });
    expect(retCode(ds)).toBe(1);
  });

  it("wraps a single row in an array", () => {
    const ds = parseDataSetResponse(diffgram("TenantLogin", `<Table><TenantID>7</TenantID></Table>`), "TenantLogin");
    expect(ds.Table).toEqual([{ TenantID: "7" }]);
  });

  it("raises SOAP faults", () => {
    const xml = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultstring>Bad login</faultstring></soap:Fault></soap:Body></soap:Envelope>`;
    expect(() => parseDataSetResponse(xml, "TenantLogin")).toThrow(SiteLinkSoapFault);
  });
});

describe("SOAP envelope builder", () => {
  it("orders params from the live WSDL contract and injects + escapes auth", () => {
    const xml = buildEnvelope("ReservationNewWithSource_v5", AUTH, { sTenantID: "55", sUnitID: "101", iSource: 5, QTRentalTypeID: 2, dcQuotedRate: 99 });
    const names = CONTRACT.ReservationNewWithSource_v5.params.map((p) => p.name);
    const positions = names.map((n) => xml.indexOf(`<${n}>`));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(xml).toContain("<sCorpPassword>p@ss&lt;word&gt;</sCorpPassword>");
    expect(xml).toContain("<QTRentalTypeID>2</QTRentalTypeID>");
    expect(xml).toContain("<iSource>5</iSource>");
    expect(xml).toContain("<dcQuotedRate>99.00</dcQuotedRate>");
    expect(xml).toContain(`xmlns="${CONTRACT.ReservationNewWithSource_v5.namespace}"`);
  });

  it("rejects params that are not in the contract", () => {
    expect(() => buildEnvelope("SiteInformation", AUTH, { sMadeUp: "x" })).toThrow(/unknown parameter/);
  });

  it("refuses caller-supplied auth params", () => {
    expect(() => buildEnvelope("ReservationNewWithSource_v5", AUTH, { sCorpPassword: "x" })).toThrow();
  });

  it("formats datetimes as Halifax wall-clock without an offset", () => {
    expect(toSiteLinkDateTime(new Date("2026-07-01T16:00:00Z"))).toBe("2026-07-01T13:00:00");
    expect(toSiteLinkDateTime(new Date("2026-01-15T16:00:00Z"))).toBe("2026-01-15T12:00:00");
  });
});

describe("move-in cost / HST", () => {
  it("uses SiteLink tax columns when present and shows HST as its own figure", () => {
    const cost = mapMoveInCost(
      [
        { ChargeDescription: "Rent", ChargeAmount: "100.00", dcTax1: "14.00" },
        { ChargeDescription: "Admin Fee", ChargeAmount: "20.00", dcTax1: "2.80" },
      ],
      0.14,
    );
    expect(cost.taxSource).toBe("sitelink");
    expect(cost.preTax).toBe(120);
    expect(cost.tax).toBe(16.8);
    expect(cost.total).toBe(136.8);
    expect(cost.lines.map((l) => l.label)).toEqual(["Rent", "Admin Fee"]);
  });

  it("computes HST locally when SiteLink returns no tax columns", () => {
    const cost = mapMoveInCost([{ ChargeDescription: "Rent", ChargeAmount: "99.99" }], 0.14);
    expect(cost.taxSource).toBe("computed");
    expect(cost.tax).toBe(14);
    expect(cost.total).toBe(113.99);
  });

  it("subtracts discounts before tax", () => {
    const cost = mapMoveInCost([{ ChargeDescription: "Rent", ChargeAmount: "100", dcDiscount: "50" }], 0.14);
    expect(cost.preTax).toBe(50);
    expect(cost.lines.find((l) => l.kind === "discount")?.amount).toBe(-50);
    expect(cost.tax).toBe(7);
  });
});
