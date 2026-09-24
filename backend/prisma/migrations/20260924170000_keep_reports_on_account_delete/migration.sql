-- Şikayet eden hesap silinince şikayet kaydı kalsın, yalnızca kimlik boşaltılsın
ALTER TABLE "ContentReport" DROP CONSTRAINT "ContentReport_reporterId_fkey";

ALTER TABLE "ContentReport" ALTER COLUMN "reporterId" DROP NOT NULL;

ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
