import type { LatLng } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, LocateFixed, MapPin, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationOrigin } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { searchAreas, type Area } from '../../store/area';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

interface AreaButtonProps {
  style?: StyleProp<ViewStyle>;
  /** Bölge ya da GPS seçildikten sonra (ör. haritayı oraya uçurmak için) */
  onPicked?: (center: LatLng | null) => void;
}

/** Üst başlıktaki "📍 Kadıköy / Moda ▾" düğmesi; dokununca bölge seçici açılır */
export function AreaButton({ style, onPicked }: AreaButtonProps) {
  const { colors, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const { manual, coords, isFallback } = useLocationOrigin();
  const [open, setOpen] = useState(false);

  const label = manual?.name ?? (coords ? t.area.current : isFallback ? t.area.choose : t.area.locating);
  const Icon = manual ? MapPin : LocateFixed;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, shadow.pin, pressed && styles.pressed, style]}
        accessibilityRole="button"
        accessibilityLabel={`${t.area.title}: ${label}`}
      >
        <Icon size={16} color={isFallback ? colors.warning : colors.primary} strokeWidth={2.4} />
        <Text style={[styles.buttonText, isFallback && { color: colors.warning }]} numberOfLines={1}>
          {label}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} strokeWidth={2.4} />
      </Pressable>
      {open && <AreaSheet onClose={() => setOpen(false)} onPicked={onPicked} />}
    </>
  );
}

function AreaSheet({ onClose, onPicked }: { onClose: () => void; onPicked?: (center: LatLng | null) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { manual, selectArea, followGps } = useLocationOrigin();
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);
  const results = searchAreas(query);

  const pick = (area: Area) => {
    Haptics.selectionAsync();
    selectArea(area);
    onPicked?.(area);
    onClose();
  };

  const onUseGps = async () => {
    Haptics.selectionAsync();
    setGpsFailed(false);
    setLocating(true);
    const fix = await followGps();
    setLocating(false);
    // Konum alınamadıysa pencere açık kalır: kullanıcı bir bölge seçebilir
    if (!fix) {
      setGpsFailed(true);
      return;
    }
    onPicked?.(fix);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.suggest.close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title}>{t.area.title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t.suggest.close}>
            <X size={18} color={colors.text} />
          </Pressable>
        </View>

        <Pressable
          onPress={onUseGps}
          disabled={locating}
          style={({ pressed }) => [styles.gps, !manual && styles.gpsActive, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ busy: locating, selected: !manual }}
        >
          <View style={styles.gpsIcon}>
            {locating ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <LocateFixed size={18} color={colors.textInverse} strokeWidth={2.4} />
            )}
          </View>
          <View style={styles.flex}>
            <Text style={styles.gpsTitle}>{t.area.useGps}</Text>
            <Text style={styles.gpsHint}>{locating ? t.area.locating : t.area.gpsHint}</Text>
          </View>
          {!manual && !locating && <Check size={18} color={colors.primary} strokeWidth={2.6} />}
        </Pressable>
        {gpsFailed && <Text style={styles.error}>{t.area.gpsFailed}</Text>}

        <View style={styles.search}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.area.search}
            placeholderTextColor={colors.closed}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={t.home.clearSearch}>
              <X size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.label}>{query.trim() ? t.area.results : t.area.popular}</Text>
        <FlatList
          data={results}
          keyExtractor={(a) => a.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t.area.noResults}</Text>}
          renderItem={({ item }) => {
            const active = manual?.id === item.id;
            return (
              <Pressable
                onPress={() => pick(item)}
                style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <MapPin size={18} color={active ? colors.primary : colors.textMuted} />
                <Text style={[styles.rowText, active && { color: colors.primary }]}>{item.name}</Text>
                {active && <Check size={18} color={colors.primary} strokeWidth={2.6} />}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  button: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: colors.text },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    maxHeight: '85%',
    gap: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },

  gps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  gpsActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  gpsIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  gpsTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  gpsHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  error: { fontSize: 13, lineHeight: 18, color: colors.warning, fontWeight: '600' },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  label: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.sm, borderRadius: 12 },
  rowActive: { backgroundColor: colors.primarySoft },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  empty: { fontSize: 14, color: colors.textMuted, paddingVertical: spacing.md },
}));
