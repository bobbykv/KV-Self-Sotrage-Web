-- AlterTable
ALTER TABLE "Hold" ADD COLUMN "concessionId" INTEGER,
ADD COLUMN "autoBillEnabled" BOOLEAN NOT NULL DEFAULT false;
