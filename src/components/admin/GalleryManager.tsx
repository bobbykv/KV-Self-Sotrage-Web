"use client";

import { useActionState, useState } from "react";
import { LOCATION_KEYS } from "@/config/locations";
import { deletePhotoAction, movePhotoAction, setCoverAction, updatePhotoAction, uploadGalleryAction, type PhotoFormState } from "@/app/admin/(console)/photos/actions";

export type GalleryPhotoView = {
  id: string;
  kind: "location" | "unit_type";
  locationKey: string;
  unitTypeName: string | null;
  widthFt: number | null;
  lengthFt: number | null;
  climate: boolean | null;
  url: string;
  caption: string | null;
  altText: string;
  sortOrder: number;
  isCover: boolean;
};

export function GalleryManager({ locationPhotos, unitTypePhotos }: { locationPhotos: GalleryPhotoView[]; unitTypePhotos: GalleryPhotoView[] }) {
  const [kind, setKind] = useState<"location" | "unit_type">("location");
  const [uploadState, uploadAction, uploading] = useActionState(uploadGalleryAction, {} as PhotoFormState);

  return (
    <div className="space-y-8">
      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold text-kv-navy">Upload photos</h2>
        <p className="text-sm text-kv-muted">Select one or more images from your computer or phone. Capture from the camera on mobile.</p>
        <form action={uploadAction} className="space-y-3" encType="multipart/form-data">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Photo type</span>
              <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as "location" | "unit_type")}>
                <option value="location">Location gallery</option>
                <option value="unit_type">Unit type</option>
              </select>
            </label>
            <label>
              <span className="label">Location</span>
              <select name="locationKey" required className="input" defaultValue="haley">
                {LOCATION_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {kind === "unit_type" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label>
                <span className="label">Unit type name</span>
                <input name="unitTypeName" className="input" placeholder="e.g. Climate 10x10" />
              </label>
              <label>
                <span className="label">Width (ft)</span>
                <input name="widthFt" type="number" step="0.5" min="1" className="input" />
              </label>
              <label>
                <span className="label">Length (ft)</span>
                <input name="lengthFt" type="number" step="0.5" min="1" className="input" />
              </label>
            </div>
          )}
          <label className="block">
            <span className="label">Photos</span>
            <input name="files" type="file" accept="image/*" capture="environment" multiple required className="block w-full text-sm" />
          </label>
          <label className="block">
            <span className="label">Caption (optional)</span>
            <input name="caption" className="input" />
          </label>
          <label className="block">
            <span className="label">Alt text (optional)</span>
            <input name="altText" className="input" />
          </label>
          {kind === "location" && (
            <label className="flex items-center gap-2 text-sm font-semibold text-kv-navy">
              <input type="checkbox" name="isCover" className="h-5 w-5" /> Set first photo as cover
            </label>
          )}
          {uploadState.error && (
            <p className="rounded-xl bg-kv-red-50 p-3 text-sm font-semibold text-kv-red" role="alert">
              {uploadState.error}
            </p>
          )}
          {uploadState.ok && uploadState.message && (
            <p className="rounded-xl bg-kv-navy-50 p-3 text-sm font-semibold text-kv-navy" role="status">
              {uploadState.message}
            </p>
          )}
          <button type="submit" disabled={uploading} className="btn-primary">
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      </section>

      <PhotoSection title="Location gallery" photos={locationPhotos} showCover showUnitFields={false} />
      <PhotoSection title="Unit-type photos" photos={unitTypePhotos} showCover={false} showUnitFields />
    </div>
  );
}

function PhotoSection({
  title,
  photos,
  showCover,
  showUnitFields,
}: {
  title: string;
  photos: GalleryPhotoView[];
  showCover: boolean;
  showUnitFields: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-kv-navy">{title}</h2>
      {!photos.length && <p className="text-sm text-kv-muted">No photos yet.</p>}
      <ul className="space-y-3">
        {photos.map((p) => (
          <li key={p.id} className="card flex flex-col gap-3 p-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.altText} className="h-28 w-40 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <form action={movePhotoAction.bind(null, p.id, "up")}>
                  <button className="btn-ghost btn-sm">Move up</button>
                </form>
                <form action={movePhotoAction.bind(null, p.id, "down")}>
                  <button className="btn-ghost btn-sm">Move down</button>
                </form>
                {showCover && (
                  <form action={setCoverAction.bind(null, p.id)}>
                    <button className="btn-navy btn-sm" disabled={p.isCover}>
                      {p.isCover ? "Cover" : "Set cover"}
                    </button>
                  </form>
                )}
                <form action={deletePhotoAction.bind(null, p.id)}>
                  <button className="btn-ghost btn-sm text-kv-red">Delete</button>
                </form>
              </div>
              <PhotoDetailsForm photo={p} showUnitFields={showUnitFields} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PhotoDetailsForm({ photo, showUnitFields }: { photo: GalleryPhotoView; showUnitFields: boolean }) {
  const [state, action, pending] = useActionState(updatePhotoAction, {} as PhotoFormState);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="id" value={photo.id} />
      <label>
        <span className="label">Caption</span>
        <input name="caption" defaultValue={photo.caption ?? ""} className="input" />
      </label>
      <label>
        <span className="label">Alt text</span>
        <input name="altText" defaultValue={photo.altText} className="input" />
      </label>
      {showUnitFields && (
        <>
          <label>
            <span className="label">Unit type name</span>
            <input name="unitTypeName" defaultValue={photo.unitTypeName ?? ""} className="input" />
          </label>
          <label>
            <span className="label">Location</span>
            <select name="locationKey" defaultValue={photo.locationKey} className="input">
              {LOCATION_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Width (ft)</span>
            <input name="widthFt" type="number" step="0.5" defaultValue={photo.widthFt ?? ""} className="input" />
          </label>
          <label>
            <span className="label">Length (ft)</span>
            <input name="lengthFt" type="number" step="0.5" defaultValue={photo.lengthFt ?? ""} className="input" />
          </label>
        </>
      )}
      {state.error && <p className="text-sm font-semibold text-kv-red sm:col-span-2">{state.error}</p>}
      {state.ok && <p className="text-sm font-semibold text-kv-navy sm:col-span-2">{state.message}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-ghost btn-sm">
          {pending ? "Saving…" : "Save details"}
        </button>
      </div>
    </form>
  );
}
