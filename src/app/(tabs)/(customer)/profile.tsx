import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { auth, db } from '../../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';

interface Measurements {
  size?: string;
  bust?: string;
  waist?: string;
  hips?: string;
  height?: string;
}

interface CustomerProfile {
  name?: string;
  fullName?: string;
  photoUrl?: string;
  avatarUrl?: string;
  memberSince?: string | number;
  loyaltyPoints?: number;
  depositBalance?: number;
  voucherCount?: number;
  address?: string;
  measurements?: Measurements;
}

interface FeatureTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}

function FeatureTile({ icon, title, onPress }: FeatureTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.featureTile}
    >
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.featureTitle} numberOfLines={2}>{title}</Text>
    </Pressable>
  );
}

export default function CustomerProfileScreen() {
  const user = auth.currentUser;
  const dirtyRef = useRef(false);
  const [profile, setProfile] = useState<CustomerProfile>({});
  const [address, setAddress] = useState('');
  const [measurements, setMeasurements] = useState<Measurements>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        if (dirtyRef.current) {
          setLoading(false);
          return;
        }
        const data = (snapshot.data() ?? {}) as CustomerProfile;
        setProfile(data);
        setAddress(typeof data.address === 'string' ? data.address : '');
        setMeasurements(
          data.measurements && typeof data.measurements === 'object'
            ? data.measurements
            : {},
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

  const saveProfile = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in again before saving your profile.');
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          email: user.email ?? '',
          role: 'customer',
          address: address.trim(),
          measurements,
        },
        { merge: true },
      );
      const saved = await getDocFromServer(doc(db, 'users', user.uid));
      if (!saved.exists()) throw new Error('The profile document was not found after saving.');
      const data = saved.data() as CustomerProfile;
      setProfile(data);
      setAddress(typeof data.address === 'string' ? data.address : '');
      setMeasurements(data.measurements ?? {});
      dirtyRef.current = false;
      setIsEditing(false);
      Alert.alert('Details updated', 'Your wardrobe profile has been saved.');
    } catch (error) {
      console.error('Could not save customer profile:', error);
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';
      Alert.alert(
        'Changes not saved',
        code === 'permission-denied'
          ? 'Firestore rejected this write. Check your rules allow signed-in users to update their own users/{uid} document.'
          : 'We could not confirm your changes with Firestore. Your edits are still here; please try again.',
      );
    } finally {
      setSaving(false);
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

  const openWishlist = () => router.push('/(tabs)/(customer)/wishlist' as Href);
  const displayName =
    profile.name?.trim() ||
    profile.fullName?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    'Rentify member';
  const memberSince = profile.memberSince ?? '2024';
  const measurementsSummary = [
    measurements.size ? `Size ${measurements.size}` : null,
    measurements.bust ? `Bust ${measurements.bust}` : null,
    measurements.waist ? `Waist ${measurements.waist}` : null,
    measurements.hips ? `Hips ${measurements.hips}` : null,
  ].filter(Boolean);

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#A96E5B', '#F2D5CD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={styles.identity}>
              {profile.avatarUrl || profile.photoUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl || profile.photoUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person-outline" size={27} color={colors.primaryDark} />
                </View>
              )}
              <View style={styles.identityText}>
                <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.memberText}>
                  Loyalty Points: {profile.loyaltyPoints ?? 150}
                </Text>
                <Text style={styles.memberText}>Member since {memberSince}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit profile settings"
                onPress={() => setIsEditing(true)}
                style={styles.headerAction}
              >
                <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open wishlist"
                onPress={openWishlist}
                style={styles.headerAction}
              >
                <Ionicons name="heart-outline" size={21} color="#FFFFFF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open rental notifications"
                onPress={() => router.push('/(tabs)/(customer)/bookings' as Href)}
                style={styles.headerAction}
              >
                <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('VIP Concierge', 'Concierge care will be available soon.')}
            style={styles.concierge}
          >
            <View style={styles.conciergeIcon}>
              <Ionicons name="sparkles-outline" size={17} color={colors.primary} />
            </View>
            <Text style={styles.conciergeText}>
              VIP Concierge: Free dry-cleaning on your next rental
            </Text>
            <Ionicons name="chevron-forward" size={17} color={colors.primary} />
          </Pressable>
        </LinearGradient>

        <Card style={[styles.card, styles.overlapCard]}>
          <View style={styles.cardHeading}>
            <Text style={styles.cardTitle}>My Fittings &amp; Rentals</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/(tabs)/(customer)/bookings' as Href)}
              style={styles.historyLink}
            >
              <Text style={styles.linkText}>View History</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.rentalActions}>
            <FeatureTile
              icon="card-outline"
              title="To Pay"
              onPress={() => router.push('/(tabs)/(customer)/cart' as Href)}
            />
            <FeatureTile
              icon="calendar-outline"
              title="Upcoming"
              onPress={() => router.push('/(tabs)/(customer)/bookings' as Href)}
            />
            <FeatureTile
              icon="shirt-outline"
              title="Ongoing"
              onPress={() => router.push('/(tabs)/(customer)/bookings' as Href)}
            />
            <FeatureTile
              icon="time-outline"
              title="To Return"
              onPress={() => router.push('/(tabs)/(customer)/bookings' as Href)}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>My Measurements &amp; Style</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.wardrobeDetails}>
              <View style={styles.wardrobeIcon}>
                <Ionicons name="body-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.wardrobeCopy}>
                <Text style={styles.measurementSummary}>
                  {measurementsSummary.length
                    ? measurementsSummary.join('  ·  ')
                    : 'Your size and measurements are not set yet.'}
                </Text>
                <Text style={styles.addressSummary} numberOfLines={2}>
                  {address || 'Add a delivery address for your rentals.'}
                </Text>
              </View>
            </View>
          )}
          {isEditing ? (
            <View style={styles.editForm}>
              <TextField
                label="Delivery address"
                value={address}
                onChangeText={(value) => {
                  dirtyRef.current = true;
                  setAddress(value);
                }}
                placeholder="Street, city, postal code"
                editable={!loading && !saving}
                multiline
                textAlignVertical="top"
                style={styles.addressInput}
              />
              <View style={styles.measurementGrid}>
                {(['size', 'bust', 'waist', 'hips', 'height'] as const).map((key) => (
                  <TextField
                    key={key}
                    label={key === 'size' ? 'Size' : `${key[0].toUpperCase()}${key.slice(1)} (cm)`}
                    value={measurements[key] ?? ''}
                    onChangeText={(value) => {
                      dirtyRef.current = true;
                      setMeasurements((current) => ({ ...current, [key]: value }));
                    }}
                    placeholder={key === 'size' ? 'e.g. M' : '—'}
                    editable={!loading && !saving}
                    style={styles.measurementInput}
                  />
                ))}
              </View>
              <Button
                title="Save wardrobe details"
                loading={saving}
                disabled={loading}
                onPress={() => void saveProfile()}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  dirtyRef.current = false;
                  setAddress(profile.address ?? '');
                  setMeasurements(profile.measurements ?? {});
                  setIsEditing(false);
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.linkText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsEditing(true)}
              style={styles.updateButton}
            >
              <Ionicons name="create-outline" size={17} color={colors.primary} />
              <Text style={styles.updateButtonText}>Update Measurements &amp; Address</Text>
            </Pressable>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Perks &amp; Styling</Text>
          <View style={styles.perksRow}>
            <FeatureTile
              icon="chatbubble-ellipses-outline"
              title="Personal Stylist"
              onPress={() => Alert.alert('Personal Stylist', 'Stylist chat will be available soon.')}
            />
            <FeatureTile
              icon="sparkles-outline"
              title="Care & Cleaning"
              onPress={() => Alert.alert('Care & Cleaning', 'Rental care details will be available soon.')}
            />
            <FeatureTile
              icon="heart-outline"
              title="My Wishlist"
              onPress={openWishlist}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Wallet &amp; Deposits</Text>
          <View style={styles.walletRow}>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.walletInfo}>
              <Text style={styles.walletLabel}>Deposit Balance</Text>
              <Text style={styles.walletValue}>
                ₱{(profile.depositBalance ?? 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.walletDivider} />
            <View style={styles.walletIcon}>
              <Ionicons name="ticket-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.walletInfo}>
              <Text style={styles.walletLabel}>Vouchers</Text>
              <Text style={styles.walletValue}>{profile.voucherCount ?? 3}</Text>
            </View>
          </View>
          <Text style={styles.walletFootnote}>
            Deposits are updated when a shop processes your returned rental.
          </Text>
        </Card>

        <View style={styles.accountActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void resetPassword()}
            disabled={resetting}
            style={styles.footerAction}
          >
            <Text style={styles.footerText}>
              {resetting ? 'Sending reset email…' : 'Reset password'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void logout()}
            disabled={signingOut}
            style={styles.footerAction}
          >
            <Ionicons name="log-out-outline" size={17} color={colors.text} />
            <Text style={styles.footerText}>{signingOut ? 'Logging out…' : 'Log Out'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, backgroundColor: colors.background },
  content: { paddingBottom: 23, gap: 13 },
  header: {
    minHeight: 206,
    paddingTop: 14,
    paddingHorizontal: 17,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: 3 },
  name: {
    color: colors.background,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  memberText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  headerAction: {
    width: 40,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(62,39,35,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  concierge: {
    minHeight: 48,
    marginTop: 22,
    borderRadius: 16,
    paddingHorizontal: 11,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conciergeIcon: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conciergeText: { flex: 1, color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
  card: {
    marginHorizontal: 15,
    padding: 15,
    gap: 14,
    backgroundColor: colors.surface,
    borderColor: colors.peach,
  },
  overlapCard: { marginTop: -20 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  historyLink: { minHeight: 36, flexDirection: 'row', alignItems: 'center' },
  linkText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  rentalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  featureTile: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 7, paddingVertical: 3 },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    minHeight: 26,
    color: colors.text,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  wardrobeDetails: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wardrobeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeCopy: { flex: 1, gap: 5 },
  measurementSummary: { color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  addressSummary: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  updateButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignSelf: 'flex-start',
    backgroundColor: colors.peach,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  updateButtonText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  editForm: { gap: 11 },
  addressInput: { minHeight: 74, paddingTop: 11 },
  measurementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  measurementInput: { width: '47%' },
  cancelButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  perksRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 12 },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletInfo: { flex: 1, minWidth: 0, gap: 4 },
  walletLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  walletValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  walletDivider: { width: 1, height: 34, backgroundColor: colors.border, marginHorizontal: 3 },
  walletFootnote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  accountActions: { gap: 2, paddingTop: 2, paddingBottom: 8 },
  footerAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  footerText: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
