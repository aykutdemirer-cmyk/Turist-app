-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "imageCredit" TEXT,
ADD COLUMN     "imageSourceUrl" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "avgPriceMaxTry" INTEGER,
ADD COLUMN     "avgPriceMinTry" INTEGER;

-- Kişi başı fiyat bandı: ikisi birlikte verilir, pozitif ve min ≤ max
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_avg_price_check" CHECK (
  ("avgPriceMinTry" IS NULL AND "avgPriceMaxTry" IS NULL)
  OR ("avgPriceMinTry" > 0 AND "avgPriceMaxTry" >= "avgPriceMinTry")
);
