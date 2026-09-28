import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { libraryDishPhoto } from './dishPhotos';
import { keywordPhoto } from './keywordPhotos';
import { formatAddress } from './nominatim';
import { extractWebsiteInfo } from './websiteInfo';

describe('extractWebsiteInfo (schema.org JSON-LD)', () => {
  it('openingHoursSpecification, telefon ve adresi okur', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Restaurant',
          telephone: '+90 216 555 12 34',
          address: { streetAddress: 'Moda Cd. 12', addressLocality: 'Kadıköy' },
          openingHoursSpecification: [
            { dayOfWeek: ['https://schema.org/Monday', 'Tuesday'], opens: '10:00:00', closes: '22:00:00' },
            { dayOfWeek: 'Saturday', opens: '12:00', closes: '02:00' },
          ],
        },
      ],
    })}</script></head></html>`;
    const info = extractWebsiteInfo(html);
    assert.equal(info.openingHours, 'Mo 10:00-22:00, Tu 10:00-22:00, Sa 12:00-02:00');
    assert.equal(info.phone, '+90 216 555 12 34');
    assert.equal(info.address, 'Moda Cd. 12, Kadıköy');
  });

  it('düz openingHours metni ve bozuk JSON', () => {
    const html =
      '<script type="application/ld+json">{bozuk</script>' +
      '<script type="application/ld+json">{"@type":"FoodEstablishment","openingHours":["Mo-Fr 09:00-18:00","Sa 10:00-14:00"]}</script>';
    assert.equal(extractWebsiteInfo(html).openingHours, 'Mo-Fr 09:00-18:00; Sa 10:00-14:00');
  });

  it('veri yoksa hiçbir şey uydurmaz', () => {
    assert.deepEqual(extractWebsiteInfo('<html><body>Merhaba</body></html>'), { openingHours: null, phone: null, address: null });
  });
});

describe('formatAddress (Nominatim)', () => {
  it('yalnızca mahalle + ilçe (tahmini sokak yazılmaz); eksikse null', () => {
    assert.equal(
      formatAddress({ road: 'Moda Caddesi', house_number: '12', suburb: 'Caferağa', city_district: 'Kadıköy' }),
      'Caferağa, Kadıköy',
    );
    assert.equal(formatAddress({ road: 'Moda Caddesi', city_district: 'Kadıköy' }), null);
  });
});

describe('libraryDishPhoto', () => {
  it('lisanslı arşivden ad eşleşmesi; kısa adda yanlış eşleşme yok', () => {
    assert.equal(libraryDishPhoto('Lahmacun')?.imageUrl, '/media/dishes/lahmacun.jpg');
    assert.equal(libraryDishPhoto('döner dürüm')?.imageUrl, '/media/dishes/doner.jpg');
    assert.equal(libraryDishPhoto('Çay'), null);
  });
});

describe('keywordPhoto (adına göre temsili görsel)', () => {
  it('addaki yemeğin görseli; özel olan genelden önce', () => {
    assert.equal(keywordPhoto('Tarihi Unkapanı Pilavcısı')?.url, '/media/dishes/nohutlu-pilav.jpg');
    assert.equal(keywordPhoto('Eminönü Balıkçısı')?.url, '/media/dishes/balik-ekmek.jpg');
    assert.equal(keywordPhoto('Mercan Kokoreç')?.url, '/media/dishes/kokorec.jpg');
    assert.equal(keywordPhoto('HD İskender kebab')?.url, '/media/dishes/adana-durum.jpg');
    assert.equal(keywordPhoto('Baydöner')?.url, '/media/dishes/doner.jpg');
    assert.equal(keywordPhoto('Köfteci Yusuf')?.url, '/media/dishes/kofte-ekmek.jpg');
    assert.equal(keywordPhoto('Tarihi Eminönü Balık Ekmek')?.representative, true);
  });

  it('ipucu yoksa görsel yok (uygulama ikon gösterir)', () => {
    assert.equal(keywordPhoto('Bambi'), null);
    assert.equal(keywordPhoto('Cadde İstiklal'), null);
  });
});
