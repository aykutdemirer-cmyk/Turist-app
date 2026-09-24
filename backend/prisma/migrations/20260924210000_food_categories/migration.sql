-- Ana sayfa yemek kategorileri
CREATE TYPE "FoodCategory" AS ENUM ('STEW', 'DONER_WRAP', 'BURGER_TOAST', 'PIDE_PIZZA', 'SOUP', 'STREET_CART', 'OLIVE_OIL_VEGAN');

ALTER TABLE "Venue" ADD COLUMN "foodCategories" "FoodCategory"[] NOT NULL DEFAULT ARRAY[]::"FoodCategory"[];

-- Mevcut esnaf lokantaları tencere yemeği sayılır; diğerleri seed ile atanır
UPDATE "Venue" SET "foodCategories" = ARRAY['STEW']::"FoodCategory"[] WHERE "type" = 'HOME_COOKING';
