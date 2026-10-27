"use client";

import { useState } from "react";
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

export function VerificationFields({ defaults, form }: { defaults?: VerificationDefaults; form?: string }) {
  const license = splitStoredRegion(defaults?.licenseRegion);
  const mailing = splitStoredRegion(defaults?.region);
  const [licenseRegion, setLicenseRegion] = useState(license.code);
  const [licenseOther, setLicenseOther] = useState(license.other);
  const [region, setRegion] = useState(mailing.code);
  const [regionOther, setRegionOther] = useState(mailing.other);
  const [preview, setPreview] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [photoError, setPhotoError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [compressing, setCompressing] = useState(false);

  async function takeFile(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    setPhotoError(undefined);
    try {
      const dataUrl = await compressIdPhoto(file);
      setPreview(dataUrl);
      setFileName("drivers-license.jpg");
    } catch (err) {
      setPreview("");
      setFileName("");
      setPhotoError(err instanceof Error ? err.message : "We couldn't use that photo.");
    } finally {
      setCompressing(false);
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="font-extrabold text-kv-navy">Your ID and mailing address</legend>
      <p className="text-sm text-kv-muted">We add these to your SiteLink lease. The reserve step stays just your name, email, phone, and move-in date.</p>
      <label className="block">
        <span className="label">Driver&apos;s license number</span>
        <input name="licenseNumber" form={form} required defaultValue={defaults?.licenseNumber ?? ""} autoComplete="off" className="input" maxLength={30} />
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
        <input name="addr1" form={form} required defaultValue={defaults?.addr1 ?? ""} autoComplete="address-line1" className="input" maxLength={80} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">City</span>
          <input name="city" form={form} required defaultValue={defaults?.city ?? ""} autoComplete="address-level2" className="input" maxLength={40} />
        </label>
        <label>
          <span className="label">Postal code</span>
          <input name="postalCode" form={form} required defaultValue={defaults?.postalCode ?? ""} autoComplete="postal-code" className="input uppercase" maxLength={12} />
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
        <p className="font-extrabold text-kv-navy">Photo of your driver&apos;s license or government ID</p>
        <p className="mt-1 text-sm text-kv-muted">
          {defaults?.idPhotoUploaded
            ? "Attach the photo again to finish. We don't keep the picture on this website."
            : "Use your camera or drop a file here. We resize it so it uploads quickly."}
        </p>
        <label className="btn-ghost mt-3 inline-flex cursor-pointer">
          {compressing ? "Preparing photo..." : preview ? "Choose a different photo" : "Take or choose a photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={compressing}
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
    </fieldset>
  );
}
