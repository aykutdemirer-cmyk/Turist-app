import { emailSchema } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogin, useRegister } from '../api/auth';
import { ApiError } from '../api/client';
import { SocialButtons } from '../components/auth/SocialButtons';
import { Field, Input } from '../components/suggest/FormControls';
import { useLocale, useT, type Dictionary } from '../i18n';
import { useAuthStore, type AuthReason } from '../store/auth';
import { makeStyles, radius, spacing, useTheme } from '../theme';

type Mode = 'login' | 'register';
type Errors = Partial<Record<'fullName' | 'email' | 'password' | 'form', string>>;

const REASONS: AuthReason[] = ['review', 'post', 'comment', 'like', 'profile'];

function errorMessage(err: unknown, t: Dictionary): string {
  if (err instanceof ApiError) {
    if (err.code === 'INVALID_CREDENTIALS') return t.auth.errors.invalidCredentials;
    if (err.code === 'EMAIL_TAKEN') return t.auth.errors.emailTaken;
    if (err.status === 429) return t.auth.errors.rateLimit;
    if (err.code === 'NETWORK_ERROR') return t.auth.errors.network;
  }
  return t.auth.errors.failed;
}

export default function AuthScreen() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ reason?: string }>();
  const reason = REASONS.find((r) => r === params.reason) ?? 'profile';

  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const login = useLogin();
  const register = useRegister();
  const busy = login.isPending || register.isPending;

  // Giriş yapılmadan kapatılırsa bekleyen eylem çalışmasın
  useEffect(
    () => () => {
      const { session, setPendingAction } = useAuthStore.getState();
      if (!session) setPendingAction(null);
    },
    [],
  );

  const finish = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { pendingAction, setPendingAction } = useAuthStore.getState();
    setPendingAction(null);
    router.back();
    // Modal kapandıktan sonra (ör. yeni gönderi ekranını açmak için)
    if (pendingAction) setTimeout(pendingAction, 350);
  }, [router]);

  // Oturum hangi yoldan açılırsa açılsın (e-posta, Google, GitHub) ekran bir kez kapanır
  const session = useAuthStore((s) => s.session);
  const finished = useRef(false);
  useEffect(() => {
    if (session && !finished.current) {
      finished.current = true;
      finish();
    }
  }, [session, finish]);

  const oauthError = useAuthStore((s) => s.oauthError);
  const oauthMessage =
    oauthError === null
      ? null
      : oauthError === 'OAUTH_NO_VERIFIED_EMAIL'
        ? t.auth.errors.oauthNoEmail
        : t.auth.errors.oauthFailed;

  const validate = (): Errors => {
    const next: Errors = {};
    if (mode === 'register' && fullName.trim().length < 2) next.fullName = t.auth.errors.fullName;
    if (!emailSchema.safeParse(email).success) next.email = t.auth.errors.email;
    if (mode === 'register' ? password.length < 8 : password.length === 0) next.password = t.auth.errors.password;
    return next;
  };

  const submit = () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const onError = (err: unknown) => setErrors({ form: errorMessage(err, t) });
    if (mode === 'login') {
      login.mutate({ email: email.trim(), password }, { onError });
    } else {
      register.mutate({ fullName: fullName.trim(), email: email.trim(), password, locale }, { onError });
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setErrors({});
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl }]}
      >
        <View style={styles.badge}>
          <Lock size={22} color={colors.primary} />
        </View>
        <Text style={font.title}>{mode === 'login' ? t.auth.loginTitle : t.auth.registerTitle}</Text>
        <Text style={[font.small, styles.reason]}>{t.auth.reasons[reason]}</Text>

        <SocialButtons disabled={busy} />
        {oauthMessage && <Text style={styles.formError}>{oauthMessage}</Text>}

        <View style={styles.orRow}>
          <View style={styles.line} />
          <Text style={font.tiny}>{t.auth.or}</Text>
          <View style={styles.line} />
        </View>

        {mode === 'register' && (
          <Field label={t.auth.fullName} error={errors.fullName}>
            <Input
              value={fullName}
              onChangeText={setFullName}
              placeholder={t.auth.fullNamePlaceholder}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              invalid={!!errors.fullName}
              maxLength={60}
            />
          </Field>
        )}

        <Field label={t.auth.email} error={errors.email}>
          <Input
            ref={emailRef}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            invalid={!!errors.email}
            maxLength={254}
          />
        </Field>

        <Field label={t.auth.password} error={errors.password}>
          <Input
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'register' ? t.auth.passwordHint : '••••••••'}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            returnKeyType="go"
            onSubmitEditing={submit}
            invalid={!!errors.password}
            maxLength={128}
          />
        </Field>

        {errors.form && <Text style={styles.formError}>{errors.form}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [styles.submit, (pressed || busy) && styles.pressed]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.submitText}>{mode === 'login' ? t.auth.login : t.auth.register}</Text>
          )}
        </Pressable>

        <Pressable onPress={switchMode} hitSlop={8} style={styles.switch}>
          <Text style={styles.switchText}>{mode === 'login' ? t.auth.switchToRegister : t.auth.switchToLogin}</Text>
        </Pressable>

        <Text style={styles.privacy}>{t.auth.privacy}</Text>
      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={[styles.close, { top: insets.top + spacing.sm }]}
        accessibilityLabel={t.suggest.close}
      >
        <X size={20} color={colors.text} />
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors, font }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  reason: { fontWeight: '400', lineHeight: 19, marginTop: -spacing.xs },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  formError: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  submit: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  submitText: { color: colors.textInverse, fontWeight: '700', fontSize: 16 },
  switch: { alignItems: 'center', paddingVertical: spacing.sm },
  switchText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  privacy: { ...font.tiny, fontWeight: '500', textAlign: 'center', lineHeight: 16 },
  close: {
    position: 'absolute',
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
