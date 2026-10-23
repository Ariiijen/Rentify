import type { ReactNode } from 'react';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { colors } from '@/constants/rentify-theme';

interface ScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

export function Screen({
  children,
  style,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
});
