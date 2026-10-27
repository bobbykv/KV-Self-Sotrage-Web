-- CreateTable
CREATE TABLE "DiscountPlanToggle" (
    "locationKey" TEXT NOT NULL,
    "concessionId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountPlanToggle_pkey" PRIMARY KEY ("locationKey","concessionId")
);

-- AlterTable
ALTER TABLE "Hold" ADD COLUMN "staffIssued" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "claimToken" TEXT;
