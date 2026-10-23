import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { auth, db } from '../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { UserRole } from '@/types';

export default function ProfileScreen() {
  const user = auth.currentUser;
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const profileRef = doc(db, 'users', user.uid);

    void getDoc(doc(db, 'users', user.uid))
      .then((snapshot) => {
        if (!active) return;
        const profileRole = snapshot.data()?.role;
        setRole(profileRole === 'shop' || profileRole === 'customer' ? profileRole : null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        console.error('Could not read user role:', error);
        if (active) {
          setLoading(false);
          Alert.alert('Profile unavailable', 'We could not load your account role.');
        }
      });

    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        const profileRole = snapshot.data()?.role;
        setRole(profileRole === 'shop' || profileRole === 'customer' ? profileRole : null);
        setLoading(false);
      },
      (error) => {
        console.error('Could not load user profile:', error);
        setLoading(false);
        Alert.alert('Profile unavailable', 'We could not load your profile details.');
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Could not sign out:', error);
      Alert.alert('Sign out failed', 'Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Your profile</Text>
        <Text style={styles.subtitle}>Manage your Rentify account.</Text>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <Text style={styles.accountHeading}>Account details</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>EMAIL</Text>
          <Text style={styles.value}>{user?.email ?? 'Not available'}</Text>
          <Text style={[styles.label, styles.roleLabel]}>ACCOUNT TYPE</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.roleLoading} />
          ) : (
            <Text style={styles.value}>
              {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Not set'}
            </Text>
          )}
        </Card>

        <Button
          title="Sign out"
          variant="secondary"
          icon="log-out-outline"
          loading={signingOut}
          onPress={handleSignOut}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 18,
  },
  content: {
    paddingTop: 26,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 15,
  },
  profileCard: {
    marginBottom: 12,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  accountHeading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 17,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 6,
  },
  roleLabel: {
    marginTop: 19,
  },
  roleLoading: {
    alignSelf: 'flex-start',
    marginTop: 9,
  },
});
