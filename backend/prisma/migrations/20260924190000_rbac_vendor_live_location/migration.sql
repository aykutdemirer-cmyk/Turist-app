-- Rol tabanlı yönetim: VENDOR / SUPER_ADMIN, esnaf paneli, seyyar canlı konumu, duyuru onayı

-- Roller: ADMIN → SUPER_ADMIN (mevcut yöneticiler yetkisini korur), yeni VENDOR
ALTER TYPE "UserRole" RENAME VALUE 'ADMIN' TO 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'VENDOR' BEFORE 'SUPER_ADMIN';

-- Mekan durumu: PENDING → PENDING_APPROVAL, APPROVED → ACTIVE (satırlar kendiliğinden taşınır)
ALTER TYPE "VenueStatus" RENAME VALUE 'PENDING' TO 'PENDING_APPROVAL';
ALTER TYPE "VenueStatus" RENAME VALUE 'APPROVED' TO 'ACTIVE';
ALTER TABLE "Venue" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('STATIC', 'DYNAMIC_STREET');
CREATE TYPE "AnnouncementType" AS ENUM ('ANNOUNCEMENT', 'PROMOTION');
CREATE TYPE "AnnouncementStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- isMobile → locationType (veri korunarak)
ALTER TABLE "Venue" ADD COLUMN "locationType" "LocationType" NOT NULL DEFAULT 'STATIC';
UPDATE "Venue" SET "locationType" = 'DYNAMIC_STREET' WHERE "isMobile" = true;
ALTER TABLE "Venue" DROP COLUMN "isMobile";

ALTER TABLE "Venue"
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "isLiveLocation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "liveLatitude" DOUBLE PRECISION,
  ADD COLUMN "liveLongitude" DOUBLE PRECISION,
  ADD COLUMN "lastLocationUpdate" TIMESTAMP(3),
  ADD COLUMN "openOverride" BOOLEAN,
  ADD COLUMN "openOverrideAt" TIMESTAMP(3);

-- Canlı konum ya tam (enlem+boylam+zaman) ya hiç; koordinatlar geçerli aralıkta
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_live_location_complete" CHECK (
  ("liveLatitude" IS NULL AND "liveLongitude" IS NULL)
  OR ("liveLatitude" BETWEEN -90 AND 90 AND "liveLongitude" BETWEEN -180 AND 180 AND "lastLocationUpdate" IS NOT NULL)
);
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_live_flag_has_coords" CHECK (NOT "isLiveLocation" OR "liveLatitude" IS NOT NULL);
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_open_override_has_time" CHECK ("openOverride" IS NULL OR "openOverrideAt" IS NOT NULL);

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN "portion" TEXT;

-- CreateTable
CREATE TABLE "VendorAnnouncement" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "VendorAnnouncement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VendorAnnouncement_title_length" CHECK (char_length("title") BETWEEN 3 AND 80),
    CONSTRAINT "VendorAnnouncement_content_length" CHECK (char_length("content") BETWEEN 3 AND 500)
);

-- CreateIndex
CREATE INDEX "VendorAnnouncement_status_createdAt_idx" ON "VendorAnnouncement"("status", "createdAt");
CREATE INDEX "VendorAnnouncement_venueId_status_idx" ON "VendorAnnouncement"("venueId", "status");
CREATE INDEX "Venue_ownerId_idx" ON "Venue"("ownerId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorAnnouncement" ADD CONSTRAINT "VendorAnnouncement_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
