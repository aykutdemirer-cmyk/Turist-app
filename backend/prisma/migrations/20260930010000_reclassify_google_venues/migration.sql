-- Google mekanları: "turkish_restaurant" türü yüzünden "Kebap & Dürüm" sayılanlar yeniden sınıflandırılır
-- (sokak lezzetleri önce; adı kebapçı olmayanlar yerel restoran)
UPDATE "Venue"
SET "liveCategory" = 'STREET_FOOD', "type" = 'LOCAL_BURGER_WRAP'
WHERE "externalId" LIKE 'google:%'
  AND lower("name") ~ '(ç|c)i(ğ|g)[ _-]?k(ö|o)fte|kokore(ç|c)|midye|tantuni|simit|bal(ı|i)k[ _-]?ekmek|kumpir';

UPDATE "Venue"
SET "liveCategory" = 'LOCAL_RESTAURANT', "type" = 'HOME_COOKING'
WHERE "externalId" LIKE 'google:%'
  AND "liveCategory" = 'KEBAB_WRAP'
  AND lower("name") !~ 'kebab|kebap|doner|döner|shawarma|durum|dürüm|ocakbaşı|ocakbasi|adana|urfa|iskender|şiş';
