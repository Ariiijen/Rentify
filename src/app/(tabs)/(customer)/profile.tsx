import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { auth, db } from '../../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';

interface Measurements {
  bust?: string;
  waist?: string;
  hips?: string;
  height?: string;
}

export default function CustomerProfileScreen() {
  const user = auth.currentUser;
  const [address, setAddress] = useState('');
  const [measurements, setMeasurements] = useState<Measurements>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const data = snapshot.data();
        setAddress(typeof data?.address === 'string' ? data.address : '');
        const value = data?.measurements;
        setMeasurements(
          value && typeof value === 'object' ? (value as Measurements) : {},
        );
        setLoading(false);
      },
      (error) => {
        console.error('Could not load customer profile:', error);
        setLoading(false);
        Alert.alert('Profile unavailable', 'We could not load your profile.');
      },
    );
  }, [user]);

  const updateMeasurement = (key: keyof Measurements, value: string) => {
    setMeasurements((current) => ({ ...current, [key]: value }));
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          address: address.trim(),
          measurements,
        },
        { merge: true },
      );
      Alert.alert('Profile saved', 'Your address and measurements were updated.');
    } catch (error) {
      console.error('Could not save customer profile:', error);
      Alert.alert('Changes not saved', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!user?.email) {
      Alert.alert('Email unavailable', 'Your account does not have an email address.');
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert('Reset email sent', `Check ${user.email} for a password reset link.`);
    } catch (error) {
      console.error('Could not send password reset email:', error);
      Alert.alert('Reset email not sent', 'Please try again in a moment.');
    } finally {
      setResetting(false);
    }
  };

  const logout = async () => {
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Keep your rental details up to date.</Text>
        </View>

        <Card style={styles.accountCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={29} color={colors.primary} />
          </View>
          <Text style={styles.accountLabel}>SIGNED IN AS</Text>
          <Text style={styles.email}>{user?.email ?? 'Email unavailable'}</Text>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Delivery address</Text>
          <TextField
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Street, city, postal code"
            multiline
            textAlignVertical="top"
            style={styles.addressInput}
          />

          <View style={styles.measurementHeader}>
            <Text style={styles.sectionTitle}>Measurements</Text>
            <Text style={styles.unitHint}>Enter in cm or inches</Text>
          </View>
          <View style={styles.measurementGrid}>
            <TextField
              label="Bust"
              value={measurements.bust ?? ''}
              onChangeText={(value) => updateMeasurement('bust', value)}
              placeholder="—"
              keyboardType="decimal-pad"
              style={styles.measurementInput}
            />
            <TextField
              label="Waist"
              value={measurements.waist ?? ''}
              onChangeText={(value) => updateMeasurement('waist', value)}
              placeholder="—"
              keyboardType="decimal-pad"
              style={styles.measurementInput}
            />
            <TextField
              label="Hips"
              value={measurements.hips ?? ''}
              onChangeText={(value) => updateMeasurement('hips', value)}
              placeholder="—"
              keyboardType="decimal-pad"
              style={styles.measurementInput}
            />
            <TextField
              label="Height"
              value={measurements.height ?? ''}
              onChangeText={(value) => updateMeasurement('height', value)}
              placeholder="—"
              keyboardType="decimal-pad"
              style={styles.measurementInput}
            />
          </View>
          <Button title="Save profile" loading={saving} onPress={saveProfile} />
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
        </Card>

        <Button
          title="Reset password"
          variant="secondary"
          icon="key-outline"
          loading={resetting}
          onPress={resetPassword}
        />
        <Button
          title="Log out"
          variant="secondary"
          icon="log-out-outline"
          loading={signingOut}
          onPress={logout}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 17,
  },
  content: {
    paddingTop: 20,
    paddingBottom: 25,
    gap: 13,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  accountLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  email: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    flexShrink: 1,
  },
  formCard: {
    gap: 15,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  addressInput: {
    minHeight: 84,
    paddingTop: 12,
  },
  measurementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  unitHint: {
    color: colors.muted,
    fontSize: 10,
  },
  measurementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
  },
  measurementInput: {
    width: '47%',
  },
});
