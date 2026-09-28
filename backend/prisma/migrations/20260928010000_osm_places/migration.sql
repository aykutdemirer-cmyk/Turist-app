-- OpenStreetMap yemek mekanlarının yerel kopyası (anlık Overpass yerine) ve içe aktarım kareleri
-- CreateTable
CREATE TABLE "OsmPlace" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "tags" JSONB NOT NULL,
    "photoUrl" TEXT,
    "photoCredit" TEXT,
    "tileKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OsmPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OsmImportTile" (
    "key" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3),
    "placeCount" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3),

    CONSTRAINT "OsmImportTile_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "OsmPlace_latitude_longitude_idx" ON "OsmPlace"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "OsmPlace_tileKey_idx" ON "OsmPlace"("tileKey");

