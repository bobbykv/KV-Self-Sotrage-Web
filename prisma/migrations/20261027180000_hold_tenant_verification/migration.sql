-- AlterTable
ALTER TABLE "Hold" ADD COLUMN "licenseNumber" TEXT,
ADD COLUMN "licenseRegion" TEXT,
ADD COLUMN "addr1" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "idPhotoUploaded" BOOLEAN NOT NULL DEFAULT false;
