import { legalDocument, type LegalDocId } from '@localbite/shared';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, X } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../../api/config';
import { useLanguage, useT } from '../../i18n';
import { LEGAL_CONTACT_EMAIL } from '../../lib/legal';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { useGoBack } from '../../hooks/useGoBack';

/** Kullanım Şartları / Gizlilik Politikası. Metin TR ve EN; diğer dillerde İngilizce gösterilir. */
export default function LegalScreen() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const language = useLanguage();
  const goBack = useGoBack('/profile');
  const insets = useSafeAreaInsets();
  const { doc: param } = useLocalSearchParams<{ doc: string }>();
  const id: LegalDocId = param === 'privacy' ? 'privacy' : 'terms';
  const locale = language === 'tr' ? 'tr' : 'en';
  const doc = legalDocument(id, locale, LEGAL_CONTACT_EMAIL);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={font.title}>{doc.title}</Text>
        <Text style={font.small}>
          {t.legal.updated}: {doc.updated}
          {language !== locale && ` · ${t.legal.englishOnly}`}
        </Text>

        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.paragraphs.map((p) => (
              <Text key={p} style={styles.paragraph}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        {id === 'privacy' && (
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy/delete-account-request?lang=${locale}`)}
            style={({ pressed }) => [styles.link, pressed && { opacity: 0.8 }]}
            accessibilityRole="link"
          >
            <ExternalLink size={16} color={colors.primary} />
            <Text style={styles.linkText}>{t.legal.webDeletion}</Text>
          </Pressable>
        )}
      </ScrollView>

      <Pressable
        onPress={() => goBack()}
        hitSlop={12}
        style={[styles.close, { top: insets.top + spacing.sm }]}
        accessibilityLabel={t.suggest.close}
      >
        <X size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  section: { gap: spacing.xs, marginTop: spacing.md },
  heading: { fontSize: 16, fontWeight: '800', color: colors.text },
  paragraph: { fontSize: 14, lineHeight: 21, color: colors.text },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
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
