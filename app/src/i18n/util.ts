/** Sözlüklerdeki mesafe metinleri için (lib/format i18n'e bağımlı olduğundan döngüye girmemek adına ayrı) */
export function formatDistance(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}
