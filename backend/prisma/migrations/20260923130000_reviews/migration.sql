-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('SAMPLE', 'COMMUNITY', 'GOOGLE');

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "source" "ReviewSource" NOT NULL DEFAULT 'COMMUNITY',
    "sourceUrl" TEXT,
    "originalLocale" "Locale" NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTranslation" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "ReviewTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_venueId_publishedAt_idx" ON "Review"("venueId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTranslation_reviewId_locale_key" ON "ReviewTranslation"("reviewId", "locale");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTranslation" ADD CONSTRAINT "ReviewTranslation_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Elle eklenen kısıtlar
-- Puan 1–5
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
-- Google yorumları atıf bağlantısı olmadan saklanamaz
ALTER TABLE "Review" ADD CONSTRAINT "Review_google_source_url_check" CHECK ("source" <> 'GOOGLE' OR "sourceUrl" IS NOT NULL);
