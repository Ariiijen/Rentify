import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname, router } from 'expo-router';
import type { Href } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { auth } from '../../firebaseConfig';
import { colors } from '@/constants/rentify-theme';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthResolved(true);
    });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setIntroComplete(true), 1800);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!authResolved) return;
    if (user && pathname === '/') {
      router.replace('/(tabs)/(customer)/browse' as Href);
    } else if (!user && pathname !== '/') {
      router.replace('/');
    }
  }, [authResolved, pathname, user]);

  if (!authResolved || !introComplete || (user && pathname === '/') || (!user && pathname !== '/')) {
    return (
      <View style={styles.intro}>
        <Image
          source={require('../../assets/images/rentify-mark.png')}
          resizeMode="contain"
          style={styles.logo}
        />
        <Text style={styles.brand}>Rentify</Text>
        <Text style={styles.tagline}>WARDROBE RENTALS, REIMAGINED</Text>
        {!introComplete || !authResolved ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.indicator} />
        ) : null}
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
  intro: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 210,
    height: 235,
    marginBottom: 12,
  },
  brand: {
    color: colors.text,
    fontFamily: 'serif',
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tagline: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 8,
  },
  indicator: {
    position: 'absolute',
    bottom: 54,
  },
});
