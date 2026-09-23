import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { useCreatePost } from '../../api/community';
import { Field, Input } from '../../components/suggest/FormControls';
import { useT } from '../../i18n';
import { useCurrentUser } from '../../store/auth';
import { colors, font, radius, spacing } from '../../theme';

export default function NewPostScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const createPost = useCreatePost();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'title' | 'content' | 'form', string>>>({});

  // Bu ekrana yalnızca üye gelir; oturum düşerse topluluğa dön
  if (!user) return <Redirect href="/community" />;

  const submit = () => {
    const next: typeof errors = {};
    if (title.trim().length < 3) next.title = t.community.compose.errors.title;
    if (content.trim().length < 3) next.content = t.community.compose.errors.content;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    createPost.mutate(
      { title: title.trim(), content: content.trim() },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (err) =>
          setErrors({
            form:
              err instanceof ApiError && err.status === 429
                ? t.suggest.errors.rateLimit
                : err instanceof ApiError && err.code === 'NETWORK_ERROR'
                  ? t.suggest.errors.network
                  : t.suggest.errors.failed,
          }),
      },
    );
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl }]}
      >
        <Text style={font.title}>{t.community.compose.title}</Text>

        <Field label={t.community.compose.titleLabel} error={errors.title}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={t.community.compose.titlePlaceholder}
            maxLength={120}
            returnKeyType="next"
            invalid={!!errors.title}
          />
        </Field>

        <Field label={t.community.compose.contentLabel} error={errors.content}>
          <Input
            value={content}
            onChangeText={setContent}
            placeholder={t.community.compose.contentPlaceholder}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            style={styles.textArea}
            invalid={!!errors.content}
          />
        </Field>

        {errors.form && <Text style={styles.formError}>{errors.form}</Text>}

        <Pressable
          onPress={submit}
          disabled={createPost.isPending}
          style={({ pressed }) => [styles.submit, (pressed || createPost.isPending) && styles.pressed]}
        >
          {createPost.isPending ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.submitText}>{t.community.compose.submit}</Text>
          )}
        </Pressable>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md },
  textArea: { minHeight: 160, paddingTop: spacing.sm },
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
});
