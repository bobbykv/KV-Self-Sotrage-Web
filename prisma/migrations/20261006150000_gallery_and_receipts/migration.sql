-- CreateTable
CREATE TABLE "GalleryPhoto" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "unitTypeName" TEXT,
    "widthFt" DOUBLE PRECISION,
    "lengthFt" DOUBLE PRECISION,
    "climate" BOOLEAN,
    "url" TEXT NOT NULL,
    "blobPath" TEXT,
    "caption" TEXT,
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "ledgerId" INTEGER,
    "holdId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "paymentRef" TEXT,
    "description" TEXT NOT NULL,
    "periodLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryPhoto_kind_locationKey_sortOrder_idx" ON "GalleryPhoto"("kind", "locationKey", "sortOrder");

-- CreateIndex
CREATE INDEX "GalleryPhoto_locationKey_unitTypeName_idx" ON "GalleryPhoto"("locationKey", "unitTypeName");

-- CreateIndex
CREATE INDEX "PaymentReceipt_tenantId_locationKey_createdAt_idx" ON "PaymentReceipt"("tenantId", "locationKey", "createdAt");
