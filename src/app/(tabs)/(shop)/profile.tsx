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
import { signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { auth, db } from '../../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';
import type { Booking, CartItem, Item } from '@/types';

function money(value: number) {
  return `₱${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

function includesItem(booking: Booking, itemId: string) {
  return (
    booking.itemId === itemId ||
    booking.items?.some((rentalItem: CartItem) => rentalItem.itemId === itemId) === true
  );
}

export default function ShopProfileScreen() {
  const user = auth.currentUser;
  const dirtyRef = useRef(false);
  const [items, setItems] = useState<Item[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shopName, setShopName] = useState('');
  const [lateFeePerDay, setLateFeePerDay] = useState('');
  const [depositPolicy, setDepositPolicy] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
        const data = snapshot.data();
        const policies = data?.policies;
        setShopName(typeof data?.shopName === 'string' ? data.shopName : '');
        setLateFeePerDay(
          policies && typeof policies.lateFeePerDay === 'number'
            ? String(policies.lateFeePerDay)
            : '',
        );
        setDepositPolicy(
          policies && typeof policies.depositPolicy === 'string'
            ? policies.depositPolicy
            : '',
        );
        setLoading(false);
      },
      (error) => {
        console.error('Could not load shop profile:', error);
        setLoading(false);
        Alert.alert('Profile unavailable', 'We could not load your shop details.');
      },
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'items'), where('shopId', '==', user.uid)),
      (snapshot) => {
        setItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Item));
      },
      (error) => {
        console.error('Could not load shop profile items:', error);
        Alert.alert('Items unavailable', 'We could not load your shop listings.');
      },
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'bookings'), where('shopId', '==', user.uid)),
      (snapshot) => {
        setBookings(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Booking));
      },
      (error) => {
        console.error('Could not load shop rental totals:', error);
        Alert.alert('Rental stats unavailable', 'We could not load rental totals.');
      },
    );
  }, [user]);

  const savePolicies = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in again before saving your shop profile.');
      return;
    }
    const fee = lateFeePerDay.trim() ? Number(lateFeePerDay) : 0;
    if (!Number.isFinite(fee) || fee < 0) {
      Alert.alert('Check late fee', 'Enter a valid non-negative amount.');
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          email: user.email ?? '',
          role: 'shop',
          shopName: shopName.trim(),
          policies: {
            lateFeePerDay: fee,
            depositPolicy: depositPolicy.trim(),
          },
        },
        { merge: true },
      );
      const savedProfile = await getDocFromServer(doc(db, 'users', user.uid));
      if (!savedProfile.exists()) {
        throw new Error('The shop profile document was not found after saving.');
      }
      const savedData = savedProfile.data();
      const savedPolicies = savedData.policies;
      setShopName(typeof savedData.shopName === 'string' ? savedData.shopName : '');
      setLateFeePerDay(
        savedPolicies && typeof savedPolicies.lateFeePerDay === 'number'
          ? String(savedPolicies.lateFeePerDay)
          : '',
      );
      setDepositPolicy(
        savedPolicies && typeof savedPolicies.depositPolicy === 'string'
          ? savedPolicies.depositPolicy
          : '',
      );
      dirtyRef.current = false;
      setIsEditing(false);
      Alert.alert('Policies saved', 'Your shop information has been updated.');
    } catch (error) {
      console.error('Could not save shop policies:', error);
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';
      const message =
        code === 'permission-denied'
          ? 'Firestore rejected this write. Check your Firestore rules allow signed-in users to update their own users/{uid} document.'
          : code === 'unavailable'
            ? 'Firestore is unavailable. Check your connection and try saving again.'
            : 'We could not confirm the saved shop profile with Firestore. Your edits are still on this screen; please try again.';
      Alert.alert('Policies not saved', message);
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Could not sign out shop owner:', error);
      Alert.alert('Sign out failed', 'Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.eyebrow}>SHOP SETTINGS</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your shop and rental policies.</Text>
        </View>

        <Card style={styles.accountCard}>
          <View style={styles.avatar}>
            <Ionicons name="storefront-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>SHOP OWNER</Text>
            <Text style={styles.accountEmail}>{user?.email ?? 'Email unavailable'}</Text>
          </View>
        </Card>

        <Card style={styles.form}>
          <Text style={styles.sectionTitle}>Shop information</Text>
          <TextField
            label="Shop name"
            value={shopName}
            onChangeText={(value) => {
              dirtyRef.current = true;
              setShopName(value);
            }}
            placeholder="Your shop name"
            maxLength={70}
            editable={isEditing && !loading && !saving}
          />
          <Text style={styles.sectionTitle}>Rental policies</Text>
          <TextField
            label="Late fee per day (₱)"
            value={lateFeePerDay}
            onChangeText={(value) => {
              dirtyRef.current = true;
              setLateFeePerDay(value);
            }}
            placeholder="200"
            keyboardType="decimal-pad"
            editable={isEditing && !loading && !saving}
          />
          <TextField
            label="Deposit policy"
            value={depositPolicy}
            onChangeText={(value) => {
              dirtyRef.current = true;
              setDepositPolicy(value);
            }}
            placeholder="Explain when deposits are refunded"
            multiline
            textAlignVertical="top"
            style={styles.policyInput}
            editable={isEditing && !loading && !saving}
          />
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          <Button
            title={isEditing ? 'Save shop details' : 'Edit profile'}
            loading={saving}
            disabled={loading}
            onPress={() => {
              if (isEditing) {
                void savePolicies();
              } else {
                setIsEditing(true);
              }
            }}
          />
        </Card>

        <View style={styles.listingHeader}>
          <View>
            <Text style={styles.sectionTitle}>Shop listings</Text>
            <Text style={styles.listingSubtitle}>
              {items.length} {items.length === 1 ? 'item' : 'items'} posted
            </Text>
          </View>
          <Ionicons name="storefront-outline" size={22} color={colors.primary} />
        </View>
        {items.length === 0 ? (
          <Card style={styles.emptyListings}>
            <EmptyState
              icon="shirt-outline"
              title="No listings yet"
              description="Items you post will appear here with their rental details."
            />
          </Card>
        ) : (
          items.map((item) => {
            const completedRentals = bookings.filter(
              (booking) =>
                booking.status === 'returned' && includesItem(booking, item.id),
            ).length;
            const rating =
              typeof (item as Item & { rating?: number }).rating === 'number'
                ? (item as Item & { rating: number }).rating
                : null;
            const reviewCount =
              typeof (item as Item & { reviewCount?: number }).reviewCount === 'number'
                ? (item as Item & { reviewCount: number }).reviewCount
                : 0;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.name}`}
                onPress={() => router.push(`/shop/edit-item/${item.id}`)}
              >
                <Card style={styles.listingCard}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.listingImage} />
                  ) : (
                    <View style={[styles.listingImage, styles.imageFallback]}>
                      <Ionicons name="shirt-outline" size={27} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.listingInfo}>
                    <Text style={styles.listingName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.listingType} numberOfLines={1}>{item.type}</Text>
                    <Text style={styles.listingPrice}>
                      {money(item.price)}<Text style={styles.perDay}> / day</Text>
                    </Text>
                    <View style={styles.metricsRow}>
                      <View style={styles.metric}>
                        <Ionicons name="star" size={13} color="#E9A323" />
                        <Text style={styles.metricText}>
                          {rating !== null && reviewCount > 0
                            ? `${rating.toFixed(1)} (${reviewCount})`
                            : 'No reviews'}
                        </Text>
                      </View>
                      <Text style={styles.metricText}>{completedRentals} rentals</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.muted} />
                </Card>
              </Pressable>
            );
          })
        )}

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
  screen: { paddingHorizontal: 17 },
  content: { paddingTop: 21, paddingBottom: 25, gap: 13 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  accountCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountInfo: { flex: 1, gap: 5 },
  accountLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  accountEmail: { color: colors.text, fontSize: 13, fontWeight: '600' },
  form: { gap: 15 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  policyInput: { minHeight: 90, paddingTop: 12 },
  listingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    marginBottom: -5,
  },
  listingSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  emptyListings: { paddingVertical: 4 },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  listingImage: {
    width: 76,
    height: 88,
    borderRadius: 12,
    backgroundColor: colors.lavender,
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  listingInfo: { flex: 1, minWidth: 0, paddingHorizontal: 12, gap: 4 },
  listingName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  listingType: { color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  listingPrice: { color: colors.text, fontSize: 13, fontWeight: '800' },
  perDay: { color: colors.muted, fontSize: 10, fontWeight: '500' },
  metricsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metricText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
});
