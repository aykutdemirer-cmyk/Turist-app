-- Mağaza sürümü: örnek topluluk üyeleri (seed) ve onların gönderileri, yanıtları, beğenileri (cascade) kaldırılır
DELETE FROM "User" WHERE "deviceId" LIKE 'seed-member-%';
