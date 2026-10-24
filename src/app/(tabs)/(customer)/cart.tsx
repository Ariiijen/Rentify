import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import { auth, db } from '../../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';
import type { CartItem } from '@/types';

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatMoney(value: number) {
  return `₱${value.toFixed(2)}`;
}

export default function CartScreen() {
  const user = auth.currentUser;
  const [items, setItems] = useState<CartItem[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, 'carts', user.uid),
      (snapshot) => {
        const lines = snapshot.data()?.items;
        setItems(Array.isArray(lines) ? (lines as CartItem[]) : []);
        setLoading(false);
        setLoadError(false);
      },
      (error) => {
        console.error('Could not load cart:', error);
        setLoading(false);
        setLoadError(true);
        Alert.alert('Cart unavailable', 'We could not load your cart.');
      },
    );
  }, [user]);

  const rentalDays = useMemo(() => {
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return 1;
    const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
    return Math.floor((end - start) / 86_400_000) + 1;
  }, [endDate, startDate]);

  const rentalSubtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * rentalDays, 0),
    [items, rentalDays],
  );
  const depositTotal = useMemo(
    () => items.reduce((total, item) => total + (item.deposit ?? 0), 0),
    [items],
  );

  const persistRentalDates = async () => {
    if (!user || items.length === 0) return;
    const hasValidRange =
      validDate(startDate) && validDate(endDate) && startDate <= endDate;
    const days = hasValidRange
      ? Math.floor(
          (new Date(`${endDate}T00:00:00.000Z`).getTime() -
            new Date(`${startDate}T00:00:00.000Z`).getTime()) /
            86_400_000,
        ) + 1
      : 1;
    const datedItems = items.map((item) => ({ ...item, startDate, endDate }));

    try {
      await setDoc(
        doc(db, 'carts', user.uid),
        {
          userId: user.uid,
          items: datedItems,
          total: datedItems.reduce(
            (total, item) => total + item.price * days + (item.deposit ?? 0),
            0,
          ),
        },
        { merge: true },
      );
    } catch (error) {
      console.error('Could not save rental dates:', error);
      Alert.alert('Dates not saved', 'We could not save your rental dates.');
    }
  };

  const removeItem = async (itemId: string) => {
    if (!user) return;
    const updatedItems = items.filter((item) => item.itemId !== itemId);
    try {
      if (updatedItems.length === 0) {
        await deleteDoc(doc(db, 'carts', user.uid));
      } else {
        await setDoc(
          doc(db, 'carts', user.uid),
          {
            userId: user.uid,
            items: updatedItems,
            total: updatedItems.reduce(
              (total, item) => total + item.price * rentalDays + (item.deposit ?? 0),
              0,
            ),
          },
          { merge: true },
        );
      }
    } catch (error) {
      console.error('Could not remove item from cart:', error);
      Alert.alert('Item not removed', 'Please try again.');
    }
  };

  const checkout = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to check out.');
      return;
    }
    if (items.length === 0) return;
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
      Alert.alert(
        'Check your dates',
        'Enter valid rental dates in YYYY-MM-DD format. The end date must be on or after the start date.',
      );
      return;
    }

    setSaving(true);
    try {
      const bookingItems = items.map((item) => ({
        ...item,
        startDate,
        endDate,
      }));
      const byShop = new Map<string, CartItem[]>();
      for (const item of bookingItems) {
        const shopId = item.shopId ?? '';
        const shopItems = byShop.get(shopId) ?? [];
        shopItems.push(item);
        byShop.set(shopId, shopItems);
      }

      const batch = writeBatch(db);
      for (const [shopId, shopItems] of byShop) {
        const bookingRef = doc(collection(db, 'bookings'));
        const shopSubtotal = shopItems.reduce(
          (sum, item) => sum + item.price * rentalDays + item.deposit,
          0,
        );
        batch.set(bookingRef, {
          userId: user.uid,
          shopId,
          customerName: user.displayName || user.email || 'Customer',
          items: shopItems,
          total: shopSubtotal,
          startDate,
          endDate,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      }
      batch.delete(doc(db, 'carts', user.uid));
      await batch.commit();

      Alert.alert(
        'Booking requested',
        `Your rental request${byShop.size > 1 ? 's have' : ' has'} been sent to the shop${byShop.size > 1 ? 's' : ''}.`,
        [{
          text: 'View bookings',
          onPress: () => router.replace('/(tabs)/(customer)/bookings' as Href),
        }],
      );
    } catch (error) {
      console.error('Could not check out cart:', error);
      Alert.alert('Checkout failed', 'Your cart was not submitted. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.itemId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR PICKS</Text>
            <Text style={styles.title}>Shopping cart</Text>
            <Text style={styles.subtitle}>Choose dates to see your rental total.</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState
              icon={loadError ? 'cloud-offline-outline' : 'cart-outline'}
              title={loadError ? 'Cart could not load' : 'Your cart is waiting'}
              description={
                loadError
                  ? 'Check your connection and try again.'
                  : 'Add a rental from Browse and it will show up here.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.cartCard}>
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                <Ionicons name="shirt-outline" size={25} color={colors.primary} />
              </View>
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemDetail}>{item.size ? `Size ${item.size} · ` : ''}{formatMoney(item.price)} / day</Text>
              <Text style={styles.itemDetail}>Deposit {formatMoney(item.deposit ?? 0)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name} from cart`}
              onPress={() => removeItem(item.itemId)}
              style={styles.removeButton}
            >
              <Ionicons name="trash-outline" size={19} color={colors.danger} />
            </Pressable>
          </Card>
        )}
        ListFooterComponent={
          items.length === 0 || loading ? null : (
            <View style={styles.checkoutSection}>
              <Text style={styles.sectionTitle}>Rental dates</Text>
              <Card style={styles.dateCard}>
                <TextField
                  label="Start date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  autoCapitalize="none"
                  onBlur={() => void persistRentalDates()}
                />
                <TextField
                  label="End date"
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  autoCapitalize="none"
                  onBlur={() => void persistRentalDates()}
                />
              </Card>
              <Card style={styles.summaryCard}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Rental ({rentalDays} day{rentalDays === 1 ? '' : 's'})</Text>
                  <Text style={styles.totalValue}>{formatMoney(rentalSubtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Refundable deposits</Text>
                  <Text style={styles.totalValue}>{formatMoney(depositTotal)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.grandLabel}>Total due</Text>
                  <Text style={styles.grandTotal}>{formatMoney(rentalSubtotal + depositTotal)}</Text>
                </View>
              </Card>
              <Button
                title="Checkout"
                icon="lock-closed-outline"
                loading={saving}
                onPress={checkout}
              />
            </View>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 17,
  },
  list: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 17,
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
  loader: {
    marginTop: 54,
  },
  cartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
  },
  thumbnail: {
    width: 68,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.lavender,
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    gap: 5,
  },
  itemName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  itemDetail: {
    color: colors.muted,
    fontSize: 12,
  },
  removeButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
  },
  checkoutSection: {
    gap: 12,
    marginTop: 9,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  dateCard: {
    gap: 14,
  },
  summaryCard: {
    gap: 13,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  totalValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  grandLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  grandTotal: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: '800',
  },
});
