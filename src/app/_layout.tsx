import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, usePathname, router } from 'expo-router';
import type { Href } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { auth } from '../../firebaseConfig';
import { colors } from '@/constants/rentify-theme';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthResolved(true);
    });
  }, []);

  useEffect(() => {
    if (!authResolved) return;
    if (user && pathname === '/') {
      router.replace('/(tabs)/(customer)/browse' as Href);
    } else if (!user && pathname !== '/') {
      router.replace('/');
    }
  }, [authResolved, pathname, user]);

  if (!authResolved || (user && pathname === '/') || (!user && pathname !== '/')) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="item/[id]" options={{ title: 'Item details' }} />
      <Stack.Screen name="booking/[itemId]" options={{ title: 'Book item' }} />
      <Stack.Screen name="shop-profile/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="shop" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
