# Gallery Photos Setup

This directory contains photos of storage facilities and units that have been added to the project.

## Added Photos

### Facility Location Photos

Two facility location photos have been added to the `public/photos/` directory:

1. **facility-stellarton-gate.jpg** (6.1MB) - Secure gated entrance at KV Self Storage Stellarton with stone pillars
2. **facility-exit31-exterior.jpg** (665KB) - Exterior view of KV Self Storage at Exit 31 (Highway 4) with multiple units at sunset

### Storage Unit Photos

Three storage unit photos have been added to the `public/photos/` directory:

1. **unit-5x10.jpg** (3.1MB) - Clean 5x10 storage unit with metal roll-up door
2. **unit-10x15.jpg** (3.4MB) - Spacious 10x15 storage unit with climate control  
3. **unit-10x20.jpg** (2.9MB) - Large 10x20 storage unit perfect for household goods

## How to Add Photos to the Database

There are multiple ways to add these photos to your database:

### Option 1: Run the Seed Script (Recommended for new setups)

If you're setting up the database for the first time:

```bash
npm run db:seed
```

This will add both facility and unit photos along with other seed data.

### Option 2: Run the SQL Migrations (For existing databases)

For facility photos:
```bash
psql $DATABASE_URL -f scripts/add-facility-photos.sql
```

For unit type photos:
```bash
psql $DATABASE_URL -f scripts/add-unit-photos.sql
```

Or using the connection string directly:

```bash
psql "postgresql://user:password@host:port/dbname" -f scripts/add-facility-photos.sql
psql "postgresql://user:password@host:port/dbname" -f scripts/add-unit-photos.sql
```

### Option 3: Run the TypeScript Scripts

For facility photos:
```bash
npx tsx scripts/seed-facility-photos.ts
```

For unit type photos:
```bash
npx tsx scripts/seed-unit-photos.ts
```

## What This Does

### Facility Photos
The facility location photos will be set as cover photos for their respective locations:
- **Stellarton** - Shows the secure gated entrance with stone pillars
- **Highway 4 (Exit 31)** - Shows the exterior units at sunset

These photos will appear on:
- Location listing pages
- Individual location pages
- As the default image for units at that location (when no unit-specific photo is available)

### Unit Type Photos
The unit photos will be added to the `GalleryPhoto` table as unit type photos for all three locations (haley, hwy4, stellarton). The system will automatically match these photos to units based on their dimensions:

- 5x10 units will show the 5x10 photo
- 10x15 units will show the 10x15 photo
- 10x20 units will show the 10x20 photo

## Verifying the Photos

After adding the photos, you can verify them by:

1. Logging into the admin panel at `/admin/photos`
2. Checking the "Location gallery" section for facility photos
3. Checking the "Unit-type photos" section for unit photos
4. Or querying the database:

```sql
-- View facility location photos
SELECT "locationKey", caption, url, "isCover"
FROM "GalleryPhoto" 
WHERE kind = 'location' 
  AND url LIKE '/photos/facility-%'
ORDER BY "locationKey", "sortOrder";

-- View unit type photos
SELECT "locationKey", "widthFt", "lengthFt", caption, url 
FROM "GalleryPhoto" 
WHERE kind = 'unit_type' 
  AND url LIKE '/photos/unit-%'
ORDER BY "locationKey", "widthFt", "lengthFt";
```

## Customizing Photos

To customize captions or alt text for these photos:

1. Visit `/admin/photos` in your browser
2. Find the photo in either the "Location gallery" or "Unit-type photos" section
3. Update the caption and alt text fields
4. Click "Save details"

## Photo Management

- **Location photos** can be marked as cover photos (the main photo for that location)
- **Unit type photos** are automatically matched to units by dimensions
- Photos can be reordered using the "Move up" and "Move down" buttons
- All photos are optimized and served from the `public/photos/` directory
