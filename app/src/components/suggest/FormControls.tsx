import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, font, radius, spacing } from '../../theme';

export function Step({ index, title, hint, children }: { index: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepIndex}>{index}</Text>
        <Text style={font.heading}>{title}</Text>
        {hint && <Text style={styles.stepHint}>({hint})</Text>}
      </View>
      {children}
    </View>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function Input({ invalid, style, ...props }: TextInputProps & { invalid?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.closed}
      style={[styles.input, invalid && styles.inputInvalid, style]}
      {...props}
    />
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
  emoji?: string;
}

/** 2 sütunlu seçim kartları (tek seçim) */
export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.gridItem, active && styles.gridItemActive, pressed && styles.pressed]}
          >
            {o.emoji && <Text style={styles.gridEmoji}>{o.emoji}</Text>}
            <Text style={[styles.gridLabel, active && styles.activeText]} numberOfLines={2}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Yan yana segmentler (tek seçim) */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Çoklu seçim çipleri */
export function MultiChips<T extends string>({
  options,
  values,
  onToggle,
}: {
  options: Option<T>[];
  values: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onToggle(o.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
          >
            {active && <Check size={14} color={colors.primary} strokeWidth={3} />}
            <Text style={[styles.chipText, active && styles.activeText]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  step: { gap: spacing.md },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    color: colors.textInverse,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  stepHint: { ...font.small, fontWeight: '400' },

  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  error: { fontSize: 13, color: colors.danger },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  inputInvalid: { borderColor: colors.danger },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  gridItemActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  gridEmoji: { fontSize: 20 },
  gridLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  activeText: { color: colors.primary },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: colors.text },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
});
