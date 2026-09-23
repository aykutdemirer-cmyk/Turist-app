# @localbite/app

Expo SDK 57 + Expo Router uygulaması. Harita: `react-native-maps` (iOS'ta Apple Maps, Android'de Google Maps).

## Çalıştırma

```bash
npm install            # repo kökünde
npm run dev:api        # ayrı terminalde backend (bkz. backend/README.md)
cd app && npx expo start
```

Expo Go ile QR kodu okutun. `react-native-maps`, `expo-location`, `expo-secure-store` Expo Go'da hazır gelir;
development build gerekmez.

## API adresi

`src/api/config.ts` sırayla şunları dener:

1. `EXPO_PUBLIC_API_URL` (`app/.env`, bkz. `.env.example`)
2. Expo dev sunucusunun çalıştığı makinenin IP'si + `:3000` (fiziksel cihaz ve emülatörde çalışır)
3. Android emülatör `http://10.0.2.2:3000`, iOS simülatör `http://localhost:3000`

Fiziksel cihazdan bağlanmak için backend'in `HOST=0.0.0.0` ile dinlemesi ve Windows güvenlik duvarının
3000 portuna izin vermesi gerekir.

## Yapı

```
src/
├── app/                 # Expo Router ekranları
│   ├── _layout.tsx      # QueryClient + Stack
│   ├── index.tsx        # Harita & keşif
│   └── venue/[id].tsx   # Mekan detayı (modal)
├── api/                 # fetch istemcisi (x-device-id, Accept-Language) + React Query hook'ları
├── components/          # map/ (pin, harita), venue/ (kart, karusel), filters/, ui/,
│                        # suggest/ (Gizli Lezzet Bildir modalı, konum seçici, payload + testleri)
├── hooks/useUserLocation.ts
├── lib/                 # deviceId (SecureStore + UUIDv4), format, directions
├── store/explore.ts     # Zustand: filtreler, seçili mekan, arama merkezi
├── i18n/                # en (varsayılan) + tr, cihaz diline göre
└── theme/               # renkler, boşluklar, kategori ikonları
```

## Kontroller

```bash
npx tsc --noEmit
npx expo lint
npm test               # saf mantık testleri (node:test + tsx)
npx expo-doctor
```
