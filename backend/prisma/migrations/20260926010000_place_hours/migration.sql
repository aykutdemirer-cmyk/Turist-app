-- Topluluk tarafından girilen dış kaynaklı yer saatleri
CREATE TABLE "PlaceHours" (
    "placeId" TEXT NOT NULL,
    "openingHours" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceHours_pkey" PRIMARY KEY ("placeId")
);

ALTER TABLE "PlaceHours" ADD CONSTRAINT "PlaceHours_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
