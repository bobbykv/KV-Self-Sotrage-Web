/**
 * Adapter for SiteLink's .NET DataSet responses.
 *
 * Every SiteLink method returns `<XResult>` containing an inline `<xs:schema>`
 * followed by a `<diffgr:diffgram><NewDataSet>` whose children are rows. The
 * element name of each row is its table name ("Table", "RT", "Table1", ...).
 * Values are all strings; empty/null columns are simply missing. Most methods
 * include an `RT` table with `Ret_Code` (negative = error) and `Ret_Msg`.
 *
 * We flatten that into `{ [tableName]: Row[] }` and coerce at the edges with
 * the helpers below, so no other module needs to know about DataSet XML.
 */
import { XMLParser } from "fast-xml-parser";

export type Row = Record<string, string>;
export type DataSet = Record<string, Row[]>;

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export class SiteLinkSoapFault extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteLinkSoapFault";
  }
}

function toRow(value: unknown): Row {
  const row: Row = {};
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      row[k] = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    }
  }
  return row;
}

export function parseDataSetResponse(xml: string, method: string): DataSet {
  const doc = parser.parse(xml);
  const body = doc?.Envelope?.Body;
  if (!body) throw new SiteLinkSoapFault(`${method}: response has no SOAP body`);
  if (body.Fault) {
    const reason = body.Fault.faultstring ?? body.Fault.Reason?.Text ?? "SOAP fault";
    throw new SiteLinkSoapFault(`${method}: ${typeof reason === "string" ? reason : JSON.stringify(reason)}`);
  }
  const result = body[`${method}Response`]?.[`${method}Result`];
  if (result === undefined) throw new SiteLinkSoapFault(`${method}: missing ${method}Result`);
  if (typeof result !== "object") return { Result: [{ value: String(result) }] };

  const dataSetRoot = result.diffgram?.NewDataSet ?? result.diffgram?.DocumentElement ?? result.NewDataSet;
  const out: DataSet = {};
  if (!dataSetRoot || typeof dataSetRoot !== "object") return out;
  for (const [table, rows] of Object.entries(dataSetRoot)) {
    out[table] = (Array.isArray(rows) ? rows : [rows]).map(toRow);
  }
  return out;
}

export function str(row: Row | undefined, ...keys: string[]): string {
  if (!row) return "";
  for (const k of keys) if (row[k] !== undefined && row[k] !== "") return row[k];
  return "";
}

export function num(row: Row | undefined, ...keys: string[]): number {
  const v = Number(str(row, ...keys));
  return Number.isFinite(v) ? v : 0;
}

export function optNum(row: Row | undefined, ...keys: string[]): number | null {
  const s = str(row, ...keys);
  if (s === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function bool(row: Row | undefined, ...keys: string[]): boolean {
  const s = str(row, ...keys).toLowerCase();
  return s === "true" || s === "1";
}

export function date(row: Row | undefined, ...keys: string[]): string | null {
  const s = str(row, ...keys);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
