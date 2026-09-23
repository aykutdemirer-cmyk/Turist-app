import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

/** Gezgin avatarı + sırt çantası rozeti (haritadaki karakterle aynı görünüm) */
export function AvatarBadge({ face, size = 48 }: { face: string; size?: number }) {
  const badge = Math.round(size * 0.46);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.56, lineHeight: size * 0.7 }}>{face}</Text>
      <View style={[styles.backpack, { width: badge, height: badge, borderRadius: badge / 2, right: -badge * 0.3 }]}>
        <Text style={{ fontSize: badge * 0.55 }}>🎒</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.surface,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backpack: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: colors.mobileAccent,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
