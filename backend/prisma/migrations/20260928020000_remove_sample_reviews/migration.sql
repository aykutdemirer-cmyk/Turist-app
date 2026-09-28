-- Mağaza sürümü: geliştirme için yazılmış örnek (SAMPLE) yorumlar kaldırılır; çevirileri cascade ile silinir
DELETE FROM "Review" WHERE "source" = 'SAMPLE';
