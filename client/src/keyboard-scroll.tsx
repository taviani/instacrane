import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardLift } from './keyboard';
import { colors } from './ui';

/** ScrollView qui laisse la place au clavier iOS. */
export function KeyboardScroll({
  children,
  contentContainerStyle,
  style,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const lift = useKeyboardLift();
  const insets = useSafeAreaInsets();
  const bottom = lift > 0 ? lift + 16 : Math.max(insets.bottom, 16);

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.bg }, style]}
      contentContainerStyle={[{ padding: 16, gap: 12, paddingBottom: bottom }, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {children}
    </ScrollView>
  );
}
