"use client";

import { useState } from "react";
import { emptyLicenseScan, mergeLicenseScans, parseLicenseOcr, type LicenseScan } from "@/lib/license-scan";
import { CA_PROVINCES, splitStoredRegion, US_STATES } from "@/lib/regions";

export type VerificationDefaults = {
  licenseNumber?: string | null;
  licenseRegion?: string | null;
  addr1?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  idPhotoUploaded?: boolean;
};

const TARGET_BYTES = 1.2 * 1024 * 1024;

function RegionSelect({
  name,
  otherName,
  label,
  value,
  other,
  form,
  onChange,
  onOther,
}: {
  name: string;
  otherName: string;
  label: string;
  value: string;
  other: string;
  form?: string;
  onChange: (value: string) => void;
  onOther: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="label">{label}</span>
        <select name={name} form={form} required className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <optgroup label="Canada">
            {CA_PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="United States">
            {US_STATES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <option value="OTHER">Other</option>
        </select>
      </label>
      {value === "OTHER" && (
        <label className="block">
          <span className="label">Province, state, or region</span>
          <input name={otherName} form={form} required value={other} onChange={(e) => onOther(e.target.value)} className="input" maxLength={40} />
        </label>
      )}
    </div>
  );
}

async function compressIdPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo of your driver's license or government ID.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("We couldn't read that photo. Try another one.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let quality = 0.86;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    const bytesOf = (url: string) => Math.floor((url.length - url.indexOf(",") - 1) * 0.75);
    while (bytesOf(dataUrl) > TARGET_BYTES && quality > 0.5) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (bytesOf(dataUrl) > 1.5 * 1024 * 1024) throw new Error("That photo is still too large. Take a closer picture and try again.");
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

async function localLicenseText(dataUrl: string): Promise<string> {
  const Detector = (globalThis as { TextDetector?: new () => { detect: (source: ImageBitmap) => Promise<{ rawValue?: string }[]> } }).TextDetector;
  if (!Detector) return "";
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const blocks = await new Detector().detect(bitmap);
    return blocks.map((block) => block.rawValue ?? "").join("\n");
  } finally {
    bitmap.close();
  }
}

async function scanLicense(dataUrl: string): Promise<LicenseScan> {
  const remote = fetch("/api/checkout/scan-license", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl }),
  })
    .then(async (res) => (res.ok ? ((await res.json()) as LicenseScan) : emptyLicenseScan()))
    .catch(() => emptyLicenseScan());
  const local = localLicenseText(dataUrl)
    .then((text) => (text ? parseLicenseOcr(text) : emptyLicenseScan()))
    .catch(() => emptyLicenseScan());
  const [serverFields, browserFields] = await Promise.all([remote, local]);
  return mergeLicenseScans(serverFields, browserFields);
}

export function VerificationFields({ defaults, form }: { defaults?: VerificationDefaults; form?: string }) {
  const license = splitStoredRegion(defaults?.licenseRegion);
  const mailing = splitStoredRegion(defaults?.region);
  const [licenseNumber, setLicenseNumber] = useState(defaults?.licenseNumber ?? "");
  const [licenseRegion, setLicenseRegion] = useState(license.code);
  const [licenseOther, setLicenseOther] = useState(license.other);
  const [addr1, setAddr1] = useState(defaults?.addr1 ?? "");
  const [city, setCity] = useState(defaults?.city ?? "");
  const [postalCode, setPostalCode] = useState(defaults?.postalCode ?? "");
  const [region, setRegion] = useState(mailing.code);
  const [regionOther, setRegionOther] = useState(mailing.other);
  const [preview, setPreview] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [photoError, setPhotoError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  function applyScan(fields: LicenseScan) {
    if (fields.licenseNumber) setLicenseNumber(fields.licenseNumber);
    if (fields.licenseRegion) {
      const split = splitStoredRegion(fields.licenseRegion);
      setLicenseRegion(split.code);
      setLicenseOther(split.other);
      setRegion(split.code);
      setRegionOther(split.other);
    }
    if (fields.addressLine1) setAddr1(fields.addressLine1);
    if (fields.city) setCity(fields.city);
    if (fields.postalCode) setPostalCode(fields.postalCode);
    setAutoFilled(Boolean(fields.licenseNumber || fields.addressLine1 || fields.city || fields.postalCode || fields.licenseRegion));
  }

  async function takeFile(file: File | undefined) {
    if (!file) return;
    setScanning(true);
    setPhotoError(undefined);
    setAutoFilled(false);
    try {
      const dataUrl = await compressIdPhoto(file);
      setPreview(dataUrl);
      setFileName("drivers-license.jpg");
      applyScan(await scanLicense(dataUrl));
    } catch (err) {
      setPreview("");
      setFileName("");
      setPhotoError(err instanceof Error ? err.message : "We couldn't use that photo.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="font-extrabold text-kv-navy">Snap a photo of your driver&apos;s license to auto-fill your details</legend>
      <p className="text-sm text-kv-muted">We fill in your licence and address from the photo. Please check them. Change anything that isn&apos;t right. These details go on your SiteLink lease.</p>

      <div
        className={`rounded-2xl border-2 border-dashed p-4 ${dragging ? "border-kv-navy bg-kv-navy-50" : "border-kv-line bg-white"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void takeFile(e.dataTransfer.files?.[0]);
        }}
      >
        <p className="font-extrabold text-kv-navy">Step 1 · Photo of your driver&apos;s license</p>
        <p className="mt-1 text-sm text-kv-muted">
          {scanning
            ? "Scanning license to auto-fill your info…"
            : defaults?.idPhotoUploaded
              ? "Attach the photo again to finish. We don't keep the picture on this website."
              : "Use your camera or drop a file here. We resize it so it uploads quickly."}
        </p>
        <label className="btn-ghost mt-3 inline-flex cursor-pointer">
          {scanning ? "Scanning license to auto-fill your info…" : preview ? "Choose a different photo" : "Snap or upload your license"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={scanning}
            onChange={(e) => {
              void takeFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview of your ID photo" className="mt-4 max-h-48 rounded-xl border border-kv-line object-contain" />
        )}
        {photoError && (
          <p className="mt-3 text-sm font-semibold text-kv-red" role="alert">
            {photoError}
          </p>
        )}
        <input type="hidden" name="idPhoto" form={form} value={preview} required />
        <input type="hidden" name="idPhotoName" form={form} value={fileName} />
      </div>

      {autoFilled && (
        <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">Auto-filled from your ID — please verify</p>
      )}

      <label className="block">
        <span className="label">Driver&apos;s license number</span>
        <input name="licenseNumber" form={form} required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} autoComplete="off" className="input" maxLength={30} />
      </label>
      <RegionSelect
        name="licenseRegion"
        otherName="licenseRegionOther"
        label="Issuing province / state"
        form={form}
        value={licenseRegion}
        other={licenseOther}
        onChange={setLicenseRegion}
        onOther={setLicenseOther}
      />
      <label className="block">
        <span className="label">Mailing address</span>
        <input name="addr1" form={form} required value={addr1} onChange={(e) => setAddr1(e.target.value)} autoComplete="address-line1" className="input" maxLength={80} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">City</span>
          <input name="city" form={form} required value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" className="input" maxLength={40} />
        </label>
        <label>
          <span className="label">Postal code</span>
          <input name="postalCode" form={form} required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} autoComplete="postal-code" className="input uppercase" maxLength={12} />
        </label>
      </div>
      <RegionSelect
        name="region"
        otherName="regionOther"
        label="Mailing province / state"
        form={form}
        value={region}
        other={regionOther}
        onChange={setRegion}
        onOther={setRegionOther}
      />
    </fieldset>
  );
}
