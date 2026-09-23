import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { AVATARS, avatarFace, useProfileStore, type AvatarId } from '../../store/profile';
import { colors, font, radius, shadow, spacing } from '../../theme';

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

export function AvatarPickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const avatarId = useProfileStore((s) => s.avatarId);
  const setAvatar = useProfileStore((s) => s.setAvatar);

  const choose = (id: AvatarId) => {
    Haptics.selectionAsync();
    setAvatar(id);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, shadow.card]}>
          <Text style={font.heading}>{t.avatar.title}</Text>
          <Text style={[font.small, styles.subtitle]}>{t.avatar.subtitle}</Text>
          <View style={styles.grid}>
            {AVATARS.map((a) => {
              const active = a.id === avatarId;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => choose(a.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <AvatarBadge face={avatarFace(a.id)} size={52} />
                  {active && (
                    <View style={styles.check}>
                      <Check size={12} color={colors.textInverse} strokeWidth={3.5} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.done, pressed && { opacity: 0.8 }]}>
            <Text style={styles.doneText}>{t.avatar.done}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: spacing.xl },
  sheet: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  subtitle: { fontWeight: '400', marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  option: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    marginTop: spacing.md,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: colors.textInverse, fontWeight: '700', fontSize: 15 },
});
