-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('HOME_COOKING', 'STREET_CART', 'LOCAL_BURGER_WRAP', 'DESSERT_TEA');

-- CreateEnum
CREATE TYPE "PriceLevel" AS ENUM ('BUDGET', 'MODERATE');

-- CreateEnum
CREATE TYPE "LocalTip" AS ENUM ('CASH_ONLY', 'PAY_AT_COUNTER', 'NO_RESERVATIONS', 'SELF_SERVICE_TRAY', 'SHARED_TABLES', 'POINT_TO_ORDER', 'CLOSES_WHEN_SOLD_OUT', 'LUNCH_ONLY', 'STANDING_ONLY');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('SPOTTED_TODAY', 'UPVOTE', 'NOT_HERE', 'CLOSED');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'tr');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "displayName" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "email" TEXT,
    "authProvider" TEXT,
    "authProviderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VenueType" NOT NULL,
    "isMobile" BOOLEAN NOT NULL DEFAULT false,
    "priceLevel" "PriceLevel" NOT NULL DEFAULT 'BUDGET',
    "authenticityScore" INTEGER NOT NULL DEFAULT 70,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "locationNote" TEXT,
    "neighborhood" TEXT,
    "district" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Istanbul',
    "localTips" "LocalTip"[],
    "phone" TEXT,
    "status" "VenueStatus" NOT NULL DEFAULT 'APPROVED',
    "lastSpottedAt" TIMESTAMP(3),
    "spottedCount" INTEGER NOT NULL DEFAULT 0,
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueTranslation" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT,
    "customTip" TEXT,

    CONSTRAINT "VenueTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "localName" TEXT NOT NULL,
    "isMustTry" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priceTry" DECIMAL(8,2),
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishTranslation" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "DishTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSchedule" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openMinute" INTEGER NOT NULL,
    "closeMinute" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationNote" TEXT,

    CONSTRAINT "VendorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotReport" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "dayKey" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_deviceId_key" ON "User"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_authProviderId_key" ON "User"("authProvider", "authProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_latitude_longitude_idx" ON "Venue"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Venue_type_status_idx" ON "Venue"("type", "status");

-- CreateIndex
CREATE INDEX "Venue_district_idx" ON "Venue"("district");

-- CreateIndex
CREATE UNIQUE INDEX "VenueTranslation_venueId_locale_key" ON "VenueTranslation"("venueId", "locale");

-- CreateIndex
CREATE INDEX "Dish_venueId_isMustTry_sortOrder_idx" ON "Dish"("venueId", "isMustTry", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DishTranslation_dishId_locale_key" ON "DishTranslation"("dishId", "locale");

-- CreateIndex
CREATE INDEX "VendorSchedule_venueId_dayOfWeek_idx" ON "VendorSchedule"("venueId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "SpotReport_venueId_type_createdAt_idx" ON "SpotReport"("venueId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpotReport_venueId_userId_type_dayKey_key" ON "SpotReport"("venueId", "userId", "type", "dayKey");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueTranslation" ADD CONSTRAINT "VenueTranslation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishTranslation" ADD CONSTRAINT "DishTranslation_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSchedule" ADD CONSTRAINT "VendorSchedule_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotReport" ADD CONSTRAINT "SpotReport_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotReport" ADD CONSTRAINT "SpotReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- Elle eklenen kısıtlar (Prisma şemasında ifade edilemiyor)
-- ─────────────────────────────────────────────

-- Yerellik puanı 1–100 aralığında olmalı
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_authenticityScore_check" CHECK ("authenticityScore" BETWEEN 1 AND 100);

-- Koordinatlar geçerli aralıkta olmalı
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_coordinates_check" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);

-- Program dilimleri: gün 0–6, dakika 0–1439; konum override ya ikisi birden ya hiç
ALTER TABLE "VendorSchedule" ADD CONSTRAINT "VendorSchedule_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6);
ALTER TABLE "VendorSchedule" ADD CONSTRAINT "VendorSchedule_minutes_check" CHECK ("openMinute" BETWEEN 0 AND 1439 AND "closeMinute" BETWEEN 0 AND 1439);
ALTER TABLE "VendorSchedule" ADD CONSTRAINT "VendorSchedule_location_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

-- dayKey biçimi YYYY-MM-DD
ALTER TABLE "SpotReport" ADD CONSTRAINT "SpotReport_dayKey_check" CHECK ("dayKey" ~ '^\d{4}-\d{2}-\d{2}$');
