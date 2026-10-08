-- CreateTable
CREATE TABLE "MockSiteLinkState" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockSiteLinkState_pkey" PRIMARY KEY ("id")
);
