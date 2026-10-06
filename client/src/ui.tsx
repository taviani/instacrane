import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

export const colors = {
  bg: '#ffffff',
  text: '#111111',
  muted: '#666666',
  line: '#e6e6e6',
  danger: '#9b1c1c',
  mark: '#c0392b',
  soft: '#f4f4f4',
};

export function Screen({ children, center }: { children: ReactNode; center?: boolean }) {
  return <View style={[styles.screen, center ? styles.screenCenter : null]}>{children}</View>;
}

export function Column({ children }: { children: ReactNode }) {
  return <View style={styles.column}>{children}</View>;
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Logo({ size = 88 }: { size?: number }) {
  return (
    <Image
      source={require('../assets/logo.png')}
      accessibilityLabel="Instacrane"
      style={{ width: size, height: size }}
    />
  );
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
  block,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  block?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, block ? styles.buttonBlock : null, danger ? styles.dangerButton : null, disabled ? styles.disabled : null]}
    >
      <Text style={[styles.buttonText, danger ? styles.dangerText : null]}>{label}</Text>
    </Pressable>
  );
}

export function ConfirmDialog({
  visible,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger,
}: {
  visible: boolean;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Annuler" onPress={onCancel} style={styles.backdropDismiss} />
        <View style={styles.dialog}>
          <Text style={styles.dialogText}>{message}</Text>
          <Button label="Annuler" onPress={onCancel} />
          <Button label={confirmLabel} danger={danger} onPress={onConfirm} />
        </View>
      </View>
    </Modal>
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label={label} danger={danger} onPress={() => setOpen(true)} />
      <ConfirmDialog
        visible={open}
        message={label.endsWith('?') ? label : `${label} ?`}
        confirmLabel={confirmLabel}
        danger={danger}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          void onConfirm();
        }}
      />
    </>
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
  screenCenter: { justifyContent: 'center', alignItems: 'center' },
  column: { width: '100%', maxWidth: 280, alignItems: 'center', gap: 16 },
  buttonBlock: { alignSelf: 'stretch' },
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
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdropDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  dialog: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    zIndex: 1,
  },
  dialogText: { color: colors.text, fontSize: 16 },
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
