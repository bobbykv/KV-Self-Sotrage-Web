-- Add facility location photos to the gallery
-- Run this with: psql $DATABASE_URL -f scripts/add-facility-photos.sql

-- First, unset any existing covers for these locations
UPDATE "GalleryPhoto" 
SET "isCover" = false 
WHERE kind = 'location' 
  AND "locationKey" IN ('haley', 'stellarton', 'hwy4')
  AND "isCover" = true;

-- Haley Road facility photo
INSERT INTO "GalleryPhoto" (
  id, kind, "locationKey", url, caption, "altText", 
  "sortOrder", "isCover", "createdAt", "updatedAt"
)
VALUES (
  'facility-haley-office',
  'location',
  'haley',
  '/photos/facility-haley-office.jpg',
  'KV Self Storage Haley Road office and facility',
  'KV Self Storage Haley Road location with office building and storage units',
  (SELECT COALESCE(MAX("sortOrder"), -1) + 1 FROM "GalleryPhoto" WHERE kind = 'location' AND "locationKey" = 'haley'),
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  caption = EXCLUDED.caption,
  "altText" = EXCLUDED."altText",
  "isCover" = EXCLUDED."isCover",
  "updatedAt" = NOW();

-- Stellarton facility photo (gated entrance)
INSERT INTO "GalleryPhoto" (
  id, kind, "locationKey", url, caption, "altText", 
  "sortOrder", "isCover", "createdAt", "updatedAt"
)
VALUES (
  'facility-stellarton-gate',
  'location',
  'stellarton',
  '/photos/facility-stellarton-gate.jpg',
  'Secure gated entrance at KV Self Storage Stellarton',
  'KV Self Storage Stellarton facility entrance with security gate and stone pillars',
  (SELECT COALESCE(MAX("sortOrder"), -1) + 1 FROM "GalleryPhoto" WHERE kind = 'location' AND "locationKey" = 'stellarton'),
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  caption = EXCLUDED.caption,
  "altText" = EXCLUDED."altText",
  "isCover" = EXCLUDED."isCover",
  "updatedAt" = NOW();

-- Highway 4 (Exit 31) facility photo (exterior units)
INSERT INTO "GalleryPhoto" (
  id, kind, "locationKey", url, caption, "altText", 
  "sortOrder", "isCover", "createdAt", "updatedAt"
)
VALUES (
  'facility-exit31-exterior',
  'location',
  'hwy4',
  '/photos/facility-exit31-exterior.jpg',
  'KV Self Storage at Exit 31 - Highway 4',
  'Exterior view of KV Self Storage facility at Exit 31 with multiple storage units at sunset',
  (SELECT COALESCE(MAX("sortOrder"), -1) + 1 FROM "GalleryPhoto" WHERE kind = 'location' AND "locationKey" = 'hwy4'),
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  caption = EXCLUDED.caption,
  "altText" = EXCLUDED."altText",
  "isCover" = EXCLUDED."isCover",
  "updatedAt" = NOW();

-- Show the added photos
SELECT "locationKey", caption, url, "isCover"
FROM "GalleryPhoto" 
WHERE kind = 'location' 
  AND url LIKE '/photos/facility-%stellarton%' 
  OR url LIKE '/photos/facility-%exit31%'
ORDER BY "locationKey", "sortOrder";
