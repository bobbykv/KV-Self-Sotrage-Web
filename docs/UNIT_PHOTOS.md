# Unit Photos Setup

This directory contains photos of storage units that have been added to the project.

## Added Photos

Three storage unit photos have been added to the `public/photos/` directory:

1. **unit-5x10.jpg** - Clean 5x10 storage unit with metal roll-up door
2. **unit-10x15.jpg** - Spacious 10x15 storage unit with climate control  
3. **unit-10x20.jpg** - Large 10x20 storage unit perfect for household goods

## How to Add Photos to the Database

There are three ways to add these photos to your database:

### Option 1: Run the Seed Script (Recommended for new setups)

If you're setting up the database for the first time:

```bash
npm run db:seed
```

This will add the unit photos along with other seed data.

### Option 2: Run the SQL Migration (For existing databases)

If you already have a database running:

```bash
psql $DATABASE_URL -f scripts/add-unit-photos.sql
```

Or using the connection string directly:

```bash
psql "postgresql://user:password@host:port/dbname" -f scripts/add-unit-photos.sql
```

### Option 3: Run the TypeScript Script

```bash
npx tsx scripts/seed-unit-photos.ts
```

## What This Does

The photos will be added to the `GalleryPhoto` table as unit type photos for all three locations (haley, hwy4, stellarton). The system will automatically match these photos to units based on their dimensions:

- 5x10 units will show the 5x10 photo
- 10x15 units will show the 10x15 photo
- 10x20 units will show the 10x20 photo

## Verifying the Photos

After adding the photos, you can verify them by:

1. Logging into the admin panel at `/admin/photos`
2. Checking the "Unit-type photos" section
3. Or querying the database:

```sql
SELECT "locationKey", "widthFt", "lengthFt", caption 
FROM "GalleryPhoto" 
WHERE kind = 'unit_type' 
  AND url LIKE '/photos/unit-%';
```

## Customizing Photos

To customize captions or alt text for these photos:

1. Visit `/admin/photos` in your browser
2. Find the photo in the "Unit-type photos" section
3. Update the caption and alt text fields
4. Click "Save details"
