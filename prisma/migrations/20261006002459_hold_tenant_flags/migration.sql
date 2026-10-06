-- AlterTable
ALTER TABLE "Hold" ADD COLUMN     "portalPasswordSet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantCreated" BOOLEAN NOT NULL DEFAULT false;
