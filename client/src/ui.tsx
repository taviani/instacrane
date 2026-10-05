import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

export const colors = {
  bg: '#ffffff',
  text: '#111111',
  muted: '#666666',
  line: '#e6e6e6',
  danger: '#9b1c1c',
  mark: '#c0392b',
  soft: '#f4f4f4',
};

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      autoCapitalize="none"
      autoCorrect={false}
      multiline={multiline}
      style={[styles.field, multiline ? styles.fieldMulti : null]}
    />
  );
}

export function Button({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, danger ? styles.dangerButton : null, disabled ? styles.disabled : null]}
    >
      <Text style={[styles.buttonText, danger ? styles.dangerText : null]}>{label}</Text>
    </Pressable>
  );
}

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  danger,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  danger?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      label={armed ? confirmLabel : label}
      danger={danger}
      onPress={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        void onConfirm();
      }}
    />
  );
}

export function StackMark() {
  return (
    <View accessibilityLabel="Plusieurs photos" style={styles.stack}>
      <View style={styles.stackBack} />
      <View style={styles.stackFront} />
    </View>
  );
}

export function box(style?: StyleProp<ViewStyle>) {
  return style;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
  field: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  fieldMulti: { minHeight: 88, textAlignVertical: 'top' },
  button: {
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerButton: { borderColor: colors.danger },
  dangerText: { color: colors.danger },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  stack: { position: 'absolute', top: 10, right: 10, width: 22, height: 22 },
  stackBack: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  stackFront: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});
