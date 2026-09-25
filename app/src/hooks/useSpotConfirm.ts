import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ApiError } from '../api/client';
import { useReportVenue } from '../api/venues';
import { useT } from '../i18n';
import { getPreciseLocation } from './useUserLocation';

/**
 * "Bugün burada gördüm" teyidi: anlık konumu alır (sunucu mekana ≤ 500 m ister) ve bildirir.
 * Aynı gün ikinci teyit hata değil "zaten teyit ettin" sayılır.
 */
export function useSpotConfirm(venueId: string) {
  const t = useT();
  const report = useReportVenue(venueId);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const confirm = async () => {
    setMessage(null);
    setLocating(true);
    const coords = await getPreciseLocation().catch(() => null);
    setLocating(false);
    if (!coords) {
      setMessage(t.report.needLocation);
      return;
    }
    report.mutate(
      { type: 'SPOTTED_TODAY', ...coords },
      {
        onSuccess: () => {
          setDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'ALREADY_REPORTED') {
            setDone(true);
            setMessage(t.report.already);
          } else if (err instanceof ApiError && err.code === 'TOO_FAR') {
            const distance = (err.details as { distanceMeters?: number } | undefined)?.distanceMeters ?? 0;
            setMessage(t.report.tooFar(distance));
          } else {
            setMessage(t.report.failed);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    );
  };

  return { confirm, done, message, busy: locating || report.isPending };
}
