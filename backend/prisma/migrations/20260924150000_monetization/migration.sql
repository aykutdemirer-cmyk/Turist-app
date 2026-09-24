-- AlterTable
ALTER TABLE "User" ADD COLUMN     "premiumSource" TEXT,
ADD COLUMN     "premiumUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "isPromoted" BOOLEAN NOT NULL DEFAULT false;

