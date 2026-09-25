-- Gerçek mekanlar: haritadan kalıcı kayda dönüşme, sahiplenme ve menü önerileri (PlaceHours yerine Venue.openingHours)
-- CreateEnum
CREATE TYPE "LiveCategory" AS ENUM ('KEBAB_WRAP', 'PIDE_BOREK', 'STREET_FOOD', 'BAKERY_DESSERT', 'LOCAL_RESTAURANT');

-- CreateEnum
CREATE TYPE "HoursSource" AS ENUM ('OSM', 'GOOGLE', 'COMMUNITY', 'VENDOR');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "PlaceHours" DROP CONSTRAINT "PlaceHours_updatedById_fkey";

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "coverImageCredit" TEXT,
ADD COLUMN     "coverIsRepresentative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "liveCategory" "LiveCategory",
ADD COLUMN     "openingHours" TEXT,
ADD COLUMN     "openingHoursSource" "HoursSource",
ALTER COLUMN "priceLevel" DROP NOT NULL;

-- DropTable
DROP TABLE "PlaceHours";

-- CreateTable
CREATE TABLE "VenueClaim" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "phone" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "VenueClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishSuggestion" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "userId" TEXT,
    "localName" TEXT NOT NULL,
    "priceTry" DECIMAL(8,2),
    "portion" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "DishSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueClaim_status_createdAt_idx" ON "VenueClaim"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VenueClaim_venueId_userId_key" ON "VenueClaim"("venueId", "userId");

-- CreateIndex
CREATE INDEX "DishSuggestion_status_createdAt_idx" ON "DishSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DishSuggestion_venueId_idx" ON "DishSuggestion"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_externalId_key" ON "Venue"("externalId");

-- AddForeignKey
ALTER TABLE "VenueClaim" ADD CONSTRAINT "VenueClaim_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueClaim" ADD CONSTRAINT "VenueClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishSuggestion" ADD CONSTRAINT "DishSuggestion_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishSuggestion" ADD CONSTRAINT "DishSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

