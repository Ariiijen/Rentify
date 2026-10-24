import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

import { auth, db } from '../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { CartItem, Item, ItemStatus, UserRole } from '@/types';

const statuses: ItemStatus[] = [
  'available',
  'cleaning',
  'repair',
];

const statusLabels: Partial<Record<ItemStatus, string>> = {
  available: 'Available',
  cleaning: 'Cleaning',
  repair: 'Repair',
};

const sizeGuides = [
  { size: 'S', bust: '84–88', waist: '66–70', hips: '90–94' },
  { size: 'M', bust: '89–94', waist: '71–76', hips: '95–100' },
  { size: 'L', bust: '95–102', waist: '77–84', hips: '101–108' },
  { size: 'XL', bust: '103–110', waist: '85–92', hips: '109–116' },
];

function money(value: number) {
  return `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = auth.currentUser;
  const [item, setItem] = useState<Item | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'items', id),
      (snapshot) => {
        const nextItem = snapshot.exists()
          ? ({ id: snapshot.id, ...snapshot.data() } as Item)
          : null;
        setItem(nextItem);
        setSelectedSize((current) => {
          if (!nextItem) return '';
          const availableSizes = nextItem.sizes?.length
            ? nextItem.sizes
            : nextItem.size
              ? [nextItem.size]
              : ['S', 'M', 'L', 'XL'];
          return availableSizes.includes(current) ? current : availableSizes[0];
        });
        setLoading(false);
      },
      (error) => {
        console.error('Could not load rental item:', error);
        setLoading(false);
        Alert.alert('Item unavailable', 'We could not load this rental item.');
      },
    );
  }, [id]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const accountRole = snapshot.data()?.role;
        setRole(accountRole === 'shop' || accountRole === 'customer' ? accountRole : null);
        setRoleLoading(false);
      },
      (error) => {
        console.error('Could not load item viewer role:', error);
        setRoleLoading(false);
        Alert.alert('Account unavailable', 'We could not determine your account role.');
      },
    );
  }, [user]);

  const availableSizes = useMemo(() => {
    if (item?.sizes?.length) return item.sizes;
    if (item?.size) return [item.size];
    return ['S', 'M', 'L', 'XL'];
  }, [item]);
  const isOwner = role === 'shop' && item?.shopId === user?.uid;

  const addToCart = async () => {
    if (!user || !item) {
      Alert.alert('Sign in required', 'Sign in to add a rental to your cart.');
      return;
    }
    setAdding(true);
    try {
      const cartRef = doc(db, 'carts', user.uid);
      const snapshot = await getDoc(cartRef);
      const existing = Array.isArray(snapshot.data()?.items)
        ? (snapshot.data()?.items as CartItem[])
        : [];
      if (existing.some((entry) => entry.itemId === item.id)) {
        Alert.alert('Already in your cart', 'This item is already in your rental cart.');
        return;
      }

      const cartItem: CartItem = {
        itemId: item.id,
        name: item.name,
        price: item.price,
        deposit: item.deposit ?? 0,
        photoUrl: item.photoUrl ?? '',
        shopId: item.shopId ?? '',
        startDate: '',
        endDate: '',
        size: selectedSize,
      };
      const items = [...existing, cartItem];
      await setDoc(
        cartRef,
        {
          userId: user.uid,
          items,
          total: items.reduce((total, entry) => total + entry.price + entry.deposit, 0),
        },
        { merge: true },
      );
      Alert.alert('Added to cart', `${item.name} has been added to your cart.`, [
        { text: 'Keep browsing', style: 'cancel' },
        {
          text: 'View cart',
          onPress: () => router.push('/(tabs)/(customer)/cart' as Href),
        },
      ]);
    } catch (error) {
      console.error('Could not add item to cart:', error);
      Alert.alert('Could not add item', 'Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const updateStatus = async (status: ItemStatus) => {
    if (!id || !isOwner) return;
    setUpdating(true);
    try {
      await setDoc(doc(db, 'items', id), { status }, { merge: true });
    } catch (error) {
      console.error('Could not update item status:', error);
      Alert.alert('Status not updated', 'Please try changing the status again.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (!item || !role) {
    return (
      <Screen style={styles.centered}>
        <Ionicons name="shirt-outline" size={38} color={colors.primary} />
        <Text style={styles.notFound}>This item could not be found.</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.hero}>
            <Ionicons name="shirt-outline" size={72} color={colors.primary} />
          </View>
        )}

        <Card style={styles.card}>
          <Text style={styles.type}>{item.type}</Text>
          <Text style={styles.name}>{item.name}</Text>
          {item.color ? <Text style={styles.detail}>Color: {item.color}</Text> : null}
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>RENTAL PRICE</Text>
              <Text style={styles.metricValue}>{money(item.price)} / day</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>REFUNDABLE DEPOSIT</Text>
              <Text style={styles.metricValue}>{money(item.deposit)}</Text>
            </View>
          </View>
          {role === 'customer' ? (
            <View style={styles.availability}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: item.status === 'available' ? colors.success : colors.warning },
                ]}
              />
              <Text style={styles.detail}>
                {item.status === 'available'
                  ? 'Available to rent'
                  : statusLabels[item.status] ?? 'Unavailable'}
              </Text>
            </View>
          ) : null}
        </Card>

        {role === 'customer' ? (
          <>
            <Text style={styles.sectionTitle}>Choose your size</Text>
            <Text style={styles.statusHint}>Select a size to add this item to your cart.</Text>
            <View style={styles.sizeList}>
              {availableSizes.map((size) => (
                <Button
                  key={size}
                  title={size}
                  variant={selectedSize === size ? 'primary' : 'secondary'}
                  onPress={() => setSelectedSize(size)}
                  style={styles.sizeButton}
                />
              ))}
            </View>

            <Card style={styles.guideCard}>
              <Text style={styles.guideTitle}>Size guide <Text style={styles.guideUnit}>(cm)</Text></Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableHeading]}>Size</Text>
                <Text style={[styles.tableCell, styles.tableHeading]}>Bust</Text>
                <Text style={[styles.tableCell, styles.tableHeading]}>Waist</Text>
                <Text style={[styles.tableCell, styles.tableHeading]}>Hips</Text>
              </View>
              {sizeGuides.map((row) => (
                <View key={row.size} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{row.size}</Text>
                  <Text style={styles.tableCell}>{row.bust}</Text>
                  <Text style={styles.tableCell}>{row.waist}</Text>
                  <Text style={styles.tableCell}>{row.hips}</Text>
                </View>
              ))}
              <Text style={styles.guideNote}>
                Please check the item&apos;s listed size with the shop if you need a specific fit.
              </Text>
            </Card>

            <Card style={styles.reviewsCard}>
              <View style={styles.reviewHeading}>
                <Text style={styles.guideTitle}>Reviews</Text>
                <View style={styles.rating}>
                  <Ionicons name="star" size={15} color="#E5A42B" />
                  <Text style={styles.ratingText}>—</Text>
                </View>
              </View>
              <Text style={styles.guideNote}>No reviews yet. Be the first to review this rental.</Text>
            </Card>

            <Button
              title="Add to Cart"
              icon="cart-outline"
              loading={adding}
              disabled={item.status !== 'available'}
              onPress={addToCart}
              style={styles.primaryAction}
            />
          </>
        ) : isOwner ? (
          <>
            <Text style={styles.sectionTitle}>Rental status</Text>
            <Text style={styles.statusHint}>Update availability for your customers.</Text>
            <Button
              title="Edit Item"
              icon="create-outline"
              variant="secondary"
              onPress={() =>
                router.push(`/shop/edit-item/${item.id}` as Href)
              }
              style={styles.primaryAction}
            />
            <View style={styles.statusGrid}>
              {statuses.map((status) => (
                <Button
                  key={status}
                  title={statusLabels[status] ?? status}
                  variant={status === item.status ? 'primary' : 'secondary'}
                  disabled={updating}
                  onPress={() => updateStatus(status)}
                  style={styles.statusButton}
                />
              ))}
            </View>
          </>
        ) : (
          <Card style={styles.reviewsCard}>
            <Text style={styles.guideNote}>Shop owners can manage only items in their inventory.</Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 18,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  content: {
    paddingTop: 18,
    paddingBottom: 28,
    gap: 8,
  },
  hero: {
    height: 205,
    borderRadius: 20,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  heroImage: {
    width: '100%',
    height: 250,
    borderRadius: 20,
    backgroundColor: colors.lavender,
    marginBottom: 7,
  },
  card: {
    gap: 6,
  },
  type: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 5,
  },
  detail: {
    color: colors.muted,
    fontSize: 13,
  },
  metrics: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 11,
  },
  metric: {
    flex: 1,
    gap: 5,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 17,
  },
  statusHint: {
    color: colors.muted,
    fontSize: 13,
    marginTop: -5,
  },
  sizeList: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 7,
  },
  sizeButton: {
    flex: 1,
    minHeight: 46,
  },
  guideCard: {
    marginTop: 13,
    gap: 11,
  },
  guideTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  guideUnit: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
  },
  tableHeading: {
    color: colors.text,
    fontWeight: '700',
  },
  guideNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  reviewsCard: {
    marginTop: 5,
    gap: 10,
  },
  reviewHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryAction: {
    marginTop: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 5,
  },
  statusButton: {
    minHeight: 44,
    paddingHorizontal: 13,
  },
  notFound: {
    color: colors.muted,
    fontSize: 15,
  },
});
