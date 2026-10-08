-- Add unit type photos to the gallery
-- Run this with: psql $DATABASE_URL -f scripts/add-unit-photos.sql

-- 5x10 unit photos for all locations
INSERT INTO "GalleryPhoto" (
  id, kind, "locationKey", "widthFt", "lengthFt", url, caption, "altText", 
  "sortOrder", "isCover", "createdAt", "updatedAt"
)
SELECT 
  'unit-5x10-' || location,
  'unit_type',
  location,
  5.0,
  10.0,
  '/photos/unit-5x10.jpg',
  '5x10 storage unit interior',
  'Clean 5x10 storage unit with metal roll-up door',
  (SELECT COALESCE(MAX("sortOrder"), -1) + 1 FROM "GalleryPhoto" WHERE kind = 'unit_type' AND "locationKey" = location),
  false,
  NOW(),
  NOW()
FROM (VALUES ('haley'), ('hwy4'), ('stellarton')) AS locations(location)
ON CONFLICT DO NOTHING;

-- 10x15 unit photos for all locations
INSERT INTO "GalleryPhoto" (
  id, kind, "locationKey", "widthFt", "lengthFt", url, caption, "altText", 
  "sortOrder", "isCover", "createdAt", "updatedAt"
)
SELECT 
  'unit-10x15-' || location,
  'unit_type',
  location,
  10.0,
  15.0,
  '/photos/unit-10x15.jpg',
  '10x15 storage unit interior',
  'Spacious 10x15 storage unit with climate control',
  (SELECT COALESCE(MAX("sortOrder"), -1) + 1 FROM "GalleryPhoto" WHERE kind = 'unit_type' AND "locationKey" = location),
  false,
  NOW(),
  NOW()
FROM (VALUES ('haley'), ('hwy4'), ('stellarton')) AS locations(location)
ON CONFLICT DO NOTHING;

-- 10x20 unit photos for all locations
INSERT INTO "GalleryPhoto" (
  id, kind, "locationKey", "widthFt", "lengthFt", url, caption, "altText", 
  "sortOrder", "isCover", "createdAt", "updatedAt"
)
SELECT 
  'unit-10x20-' || location,
  'unit_type',
  location,
  10.0,
  20.0,
  '/photos/unit-10x20.jpg',
  '10x20 storage unit interior',
  'Large 10x20 storage unit perfect for household goods',
  (SELECT COALESCE(MAX("sortOrder"), -1) + 1 FROM "GalleryPhoto" WHERE kind = 'unit_type' AND "locationKey" = location),
  false,
  NOW(),
  NOW()
FROM (VALUES ('haley'), ('hwy4'), ('stellarton')) AS locations(location)
ON CONFLICT DO NOTHING;

-- Show the added photos
SELECT "locationKey", "widthFt", "lengthFt", caption, url 
FROM "GalleryPhoto" 
WHERE kind = 'unit_type' 
  AND url LIKE '/photos/unit-%'
ORDER BY "locationKey", "widthFt", "lengthFt";
