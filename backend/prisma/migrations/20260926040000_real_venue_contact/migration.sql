-- Gerçek mekan: web sitesi, yaklaşık adres işareti ve WEBSITE saat kaynağı
-- AlterEnum
ALTER TYPE "HoursSource" ADD VALUE 'WEBSITE';

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "addressIsApproximate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "website" TEXT;

