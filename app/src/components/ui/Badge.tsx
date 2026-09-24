import type { ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { makeStyles, radius, useTheme } from '../../theme';

interface Props {
  label: string;
  color?: string;
  background?: string;
  icon?: ReactNode;
  style?: ViewStyle;
}

export function Badge({ label, color, background, icon, style }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.badge, { backgroundColor: background ?? colors.surfaceMuted }, style]}>
      {icon}
      <Text style={[styles.text, { color: color ?? colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
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
}));
