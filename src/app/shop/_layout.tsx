import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import type { Href } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';

import { auth, db } from '../../../firebaseConfig';
import { colors } from '@/constants/rentify-theme';

export default function ShopRoutesLayout() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      return;
    }
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const nextRole = snapshot.data()?.role;
        setRole(typeof nextRole === 'string' ? nextRole : null);
        setLoading(false);
      },
      (reason) => {
        console.error('Could not verify shop access:', reason);
        setError(true);
        setLoading(false);
      },
    );
  }, [user]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (role !== 'shop') {
    if (role === 'customer') {
      return <Redirect href={'/(tabs)/(customer)/browse' as Href} />;
    }
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          {error ? 'Shop access could not be verified.' : 'This screen is for shop accounts.'}
        </Text>
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
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  message: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 15,
  },
});
