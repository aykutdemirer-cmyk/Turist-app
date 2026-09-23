import type { VenueSummaryDTO } from '@localbite/shared';
import { Eye } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { formatRelative } from '../../lib/format';
import { colors } from '../../theme';

type Props = Pick<VenueSummaryDTO, 'isMobile' | 'isActiveNow' | 'isScheduledOpen' | 'lastSpottedAt' | 'spottedTodayCount'>;

/** Seyyarlarda topluluk teyidi, dükkanlarda açık/kapalı satırı */
export function SpottedLine({ isMobile, isActiveNow, isScheduledOpen, lastSpottedAt, spottedTodayCount }: Props) {
  const t = useT();
  if (!isMobile) {
    const open = isScheduledOpen || isActiveNow;
    return (
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: open ? colors.open : colors.closed }]} />
        <Text style={[styles.text, { color: open ? colors.open : colors.textMuted }]}>
          {open ? t.status.openNow : t.status.closed}
        </Text>
      </View>
    );
  }

  const label =
    spottedTodayCount > 0
      ? t.spotted.todayCount(spottedTodayCount)
      : lastSpottedAt
        ? t.spotted.ago(formatRelative(lastSpottedAt))
        : t.spotted.never;

  return (
    <View style={styles.row}>
      <Eye size={14} color={isActiveNow ? colors.open : colors.textMuted} />
      <Text style={[styles.text, { color: isActiveNow ? colors.open : colors.textMuted }]} numberOfLines={1}>
        {isActiveNow ? `${t.status.activeNow} · ${label}` : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
