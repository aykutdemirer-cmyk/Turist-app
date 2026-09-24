import { VENUE_TYPES, type LatLng, type LocalTip, type PriceLevel, type VenueType } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { CircleAlert, PartyPopper, Send, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { useSuggestVenue } from '../../api/venues';
import { getPreciseLocation } from '../../hooks/useUserLocation';
import { getT, useLocale, useT } from '../../i18n';
import { useAvatarFace } from '../../store/profile';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { Field, Input, MultiChips, OptionGrid, Segmented, Step } from './FormControls';
import { LocationPicker } from './LocationPicker';
import { LocationPreview, type LocationSource } from './LocationPreview';
import {
  buildSuggestPayload,
  initialSuggestForm,
  SUGGEST_TIPS,
  type SuggestErrors,
  type SuggestFormState,
} from './payload';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Kullanıcının bilinen konumu (varsa formu hemen doldurur) */
  userLocation: LatLng | null;
  /** Konum yoksa harita seçicinin başlangıç noktası (ana haritanın merkezi) */
  fallbackCenter: LatLng;
}

const TYPE_EMOJI: Record<VenueType, string> = {
  STREET_CART: '🍢',
  HOME_COOKING: '🍲',
  LOCAL_BURGER_WRAP: '🌯',
  DESSERT_TEA: '☕',
};

const AUTO_CLOSE_MS = 3500;

export function SuggestSpotModal({ visible, onClose, userLocation, fallbackCenter }: Props) {
  // Her açılışta form sıfırdan başlasın; kapanış animasyonu sırasında içerik kaybolmasın
  const [session, setSession] = useState(0);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setSession((s) => s + 1);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SuggestSpotContent
        key={session}
        onClose={onClose}
        userLocation={userLocation}
        fallbackCenter={fallbackCenter}
      />
    </Modal>
  );
}

type Mode = 'form' | 'picker' | 'success';

function SuggestSpotContent({ onClose, userLocation, fallbackCenter }: Omit<Props, 'visible'>) {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const suggest = useSuggestVenue();
  const t = useT();
  const locale = useLocale();
  const avatarFace = useAvatarFace();

  const [mode, setMode] = useState<Mode>('form');
  const [form, setForm] = useState<SuggestFormState>(() => initialSuggestForm(userLocation));
  const [source, setSource] = useState<LocationSource | null>(userLocation ? 'gps' : null);
  const [locating, setLocating] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [errors, setErrors] = useState<SuggestErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Kullanıcı haritadan elle seçtiyse, geç gelen açılış GPS sonucu onu ezmesin
  const pickedOnMap = useRef(false);

  const applyGps = useCallback((coords: LatLng | null) => {
    setLocating(false);
    setLocationDenied(coords === null);
    if (!coords || pickedOnMap.current) return;
    setForm((f) => ({ ...f, location: coords }));
    setSource('gps');
    setErrors((e) => ({ ...e, location: undefined }));
  }, []);

  // Açılışta hassas GPS konumunu al (varsayılan: "Mevcut konumumu kullan")
  useEffect(() => {
    let cancelled = false;
    getPreciseLocation()
      .catch(() => null)
      .then((coords) => {
        if (!cancelled) applyGps(coords);
      });
    return () => {
      cancelled = true;
    };
  }, [applyGps]);

  // Başarı kartı birkaç saniye sonra kendiliğinden kapanır
  useEffect(() => {
    if (mode !== 'success') return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [mode, onClose]);

  const locateMe = async () => {
    pickedOnMap.current = false;
    setLocating(true);
    applyGps(await getPreciseLocation().catch(() => null));
  };

  const update = <K extends keyof SuggestFormState>(key: K, value: SuggestFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    const field = key === 'hoursNote' || key === 'dish' || key === 'name' ? key : null;
    if (field) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const setType = (type: VenueType) =>
    setForm((f) => ({
      ...f,
      type,
      // Seyyar seçilince toggle açılır; seyyardan başka türe geçince kapanır
      isMobile: type === 'STREET_CART' ? true : f.type === 'STREET_CART' ? false : f.isMobile,
    }));

  const toggleTip = (tip: LocalTip) =>
    setForm((f) => ({ ...f, tips: f.tips.includes(tip) ? f.tips.filter((x) => x !== tip) : [...f.tips, tip] }));

  const submit = () => {
    setSubmitError(null);
    const result = buildSuggestPayload(form, locale);
    if (!result.ok) {
      setErrors(result.errors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setErrors({});
    suggest.mutate(result.payload, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMode('success');
      },
      onError: (err) => {
        setSubmitError(submitErrorMessage(err));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    });
  };

  // iOS pageSheet üstte kendi boşluğunu bırakır; Android'de modal tam ekrandır
  const topPadding = Platform.OS === 'ios' ? spacing.lg : insets.top + spacing.sm;

  if (mode === 'picker') {
    return (
      <View style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        <LocationPicker
          initial={form.location ?? userLocation ?? fallbackCenter}
          user={userLocation ? { ...userLocation, face: avatarFace } : null}
          bottomInset={insets.bottom}
          onCancel={() => setMode('form')}
          onConfirm={(location) => {
            pickedOnMap.current = true;
            setForm((f) => ({ ...f, location }));
            setSource('map');
            setErrors((e) => ({ ...e, location: undefined }));
            setMode('form');
          }}
        />
      </View>
    );
  }

  if (mode === 'success') {
    return (
      <View style={[styles.screen, styles.success, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.successIcon}>
          <PartyPopper size={40} color={colors.primary} />
        </View>
        <Text style={[font.title, styles.centerText]}>{t.suggest.successTitle}</Text>
        <Text style={[font.body, styles.centerText, { color: colors.textMuted }]}>{t.suggest.successBody}</Text>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.submit, styles.doneButton, pressed && styles.pressed]}>
          <Text style={styles.submitText}>{t.suggest.done}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { paddingTop: topPadding }]} behavior="padding">
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={font.title}>{t.suggest.title}</Text>
          <Text style={[font.small, styles.subtitle]}>{t.suggest.subtitle}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityLabel={t.suggest.close}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Step index={1} title={t.suggest.step1}>
          <LocationPreview
            location={form.location}
            source={source}
            locating={locating}
            hasError={Boolean(errors.location)}
            onUseMyLocation={locateMe}
            onPickOnMap={() => setMode('picker')}
          />
          {errors.location && <Text style={styles.fieldError}>{t.suggest.errors.location}</Text>}
          {locationDenied && !form.location && (
            <Text style={styles.warning}>{t.suggest.errors.locationDenied}</Text>
          )}
        </Step>

        <Step index={2} title={t.suggest.step2}>
          <Field label={t.suggest.nameLabel} error={errors.name ? t.suggest.errors.name : undefined}>
            <Input
              value={form.name}
              onChangeText={(v) => update('name', v)}
              placeholder={t.suggest.namePlaceholder}
              maxLength={80}
              autoCapitalize="words"
              returnKeyType="next"
              invalid={errors.name}
            />
          </Field>

          <Field label={t.suggest.typeLabel}>
            <OptionGrid
              options={VENUE_TYPES.map((type) => ({ value: type, label: t.suggest.types[type], emoji: TYPE_EMOJI[type] }))}
              value={form.type}
              onChange={setType}
            />
          </Field>

          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.switchLabel}>{t.suggest.isMobileLabel}</Text>
              <Text style={font.small}>{t.suggest.isMobileHelp}</Text>
            </View>
            <Switch
              value={form.isMobile}
              onValueChange={(v) => update('isMobile', v)}
              trackColor={{ true: colors.mobile, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </Step>

        <Step index={3} title={t.suggest.step3} hint={t.suggest.optional}>
          <Field label={t.suggest.dishLabel} error={errors.dish ? t.suggest.errors.dish : undefined}>
            <Input
              value={form.dish}
              onChangeText={(v) => update('dish', v)}
              placeholder={t.suggest.dishPlaceholder}
              maxLength={80}
              invalid={errors.dish}
            />
          </Field>

          <Field label={t.suggest.priceLabel}>
            <Segmented<PriceLevel>
              options={[
                { value: 'BUDGET', label: t.suggest.priceOptions.BUDGET },
                { value: 'MODERATE', label: t.suggest.priceOptions.MODERATE },
              ]}
              value={form.priceLevel}
              onChange={(v) => update('priceLevel', v)}
            />
          </Field>

          <Field label={t.suggest.tipsLabel}>
            <MultiChips
              options={SUGGEST_TIPS.map((tip) => ({ value: tip, label: t.tips[tip] }))}
              values={form.tips}
              onToggle={toggleTip}
            />
          </Field>

          {form.isMobile && (
            <Field label={t.suggest.hoursLabel} error={errors.hoursNote ? t.suggest.errors.hoursNote : undefined}>
              <Input
                value={form.hoursNote}
                onChangeText={(v) => update('hoursNote', v)}
                placeholder={t.suggest.hoursPlaceholder}
                maxLength={200}
                multiline
                style={styles.multiline}
                invalid={errors.hoursNote}
              />
            </Field>
          )}
        </Step>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {(submitError || errors.form) && (
          <View style={styles.submitError}>
            <CircleAlert size={16} color={colors.danger} />
            <Text style={styles.submitErrorText}>{submitError ?? t.suggest.errors.form}</Text>
          </View>
        )}
        <Pressable
          onPress={submit}
          disabled={suggest.isPending}
          style={({ pressed }) => [styles.submit, (pressed || suggest.isPending) && styles.pressed]}
        >
          {suggest.isPending ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Send size={18} color={colors.textInverse} />
          )}
          <Text style={styles.submitText}>{suggest.isPending ? t.suggest.submitting : t.suggest.submit}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function submitErrorMessage(err: unknown): string {
  const t = getT();
  if (!(err instanceof ApiError)) return t.suggest.errors.failed;
  if (err.code === 'NETWORK_ERROR') return t.suggest.errors.network;
  if (err.status === 429) return t.suggest.errors.rateLimit;
  if (err.status === 400) return t.suggest.errors.form;
  return t.suggest.errors.failed;
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  centerText: { textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  subtitle: { marginTop: 4, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl },
  fieldError: { fontSize: 13, color: colors.danger },
  warning: { fontSize: 13, color: colors.warning },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  multiline: { minHeight: 72, textAlignVertical: 'top' },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  submitError: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  submitErrorText: { flex: 1, fontSize: 13, color: colors.danger },
  submit: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submitText: { color: colors.textInverse, fontWeight: '700', fontSize: 16 },

  success: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneButton: { alignSelf: 'stretch', marginTop: spacing.lg },
}));
