-- Yaklaşık (Nominatim) adreslerde tahmini sokak adı yanlış olabiliyor: yalnızca "Mahalle, İlçe" kalsın
UPDATE "Venue"
SET "address" = regexp_replace("address", '^[^,]*,\s*', '')
WHERE "addressIsApproximate" = true AND "address" LIKE '%,%,%';
