-- Yorum kaynağı: COMMUNITY → APP (satırlar kendiliğinden taşınır), yeni OTHER
ALTER TYPE "ReviewSource" RENAME VALUE 'COMMUNITY' TO 'APP';
ALTER TYPE "ReviewSource" ADD VALUE 'OTHER';

-- Varsayılan kaldırılır: her yazma yolu kaynağı açıkça belirtir
ALTER TABLE "Review" ALTER COLUMN "source" DROP DEFAULT;
