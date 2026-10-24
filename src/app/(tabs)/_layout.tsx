import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, Slot, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { auth, db } from '../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/rentify-theme';
import type { UserRole } from '@/types';

export default function RoleTabsLayout() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState(false);
  const segments = useSegments() as string[];
  const isCustomerPath = segments.includes('(customer)');
  const isShopPath = segments.includes('(shop)');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const value = snapshot.data()?.role;
        setRole(value === 'customer' || value === 'shop' ? value : null);
        setLoading(false);
      },
      (error) => {
        console.error('Could not load account role:', error);
        setRole(null);
        setRoleError(true);
        setLoading(false);
      },
    );
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (role === 'customer' && !isCustomerPath) {
    return <Redirect href={'/(tabs)/(customer)/browse' as Href} />;
  }
  if (role === 'shop' && !isShopPath) {
    return <Redirect href={'/(tabs)/(shop)/dashboard' as Href} />;
  }
  if (!role) {
    return (
      <View style={styles.errorScreen}>
        <Text style={styles.errorTitle}>Account role unavailable</Text>
        <Text style={styles.errorMessage}>
          {roleError
            ? 'We could not load your account details. Check your connection and try again.'
            : 'This account does not have a customer or shop role yet.'}
        </Text>
        <Button
          title="Sign out"
          variant="secondary"
          icon="log-out-outline"
          onPress={() => {
            void signOut(auth).catch((error: unknown) => {
              console.error('Could not sign out:', error);
            });
          }}
          style={styles.signOut}
        />
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 9,
  },
  signOut: {
    alignSelf: 'stretch',
    marginTop: 20,
  },
});
