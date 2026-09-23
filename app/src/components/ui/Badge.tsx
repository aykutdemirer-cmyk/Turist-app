import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';

interface Props {
  label: string;
  color?: string;
  background?: string;
  icon?: ReactNode;
  style?: ViewStyle;
}

export function Badge({ label, color = colors.textMuted, background = colors.surfaceMuted, icon, style }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      {icon}
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '600' },
});
