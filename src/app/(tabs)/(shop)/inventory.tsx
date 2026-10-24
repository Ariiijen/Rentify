import { useEffect, useState } from 'react';
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
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { auth, db } from '../../../../firebaseConfig';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { Item, ItemStatus } from '@/types';

const statusColors: Record<ItemStatus, { label: string; color: string; background: string }> = {
  available: { label: 'Available', color: '#168653', background: '#E7F7EF' },
  reserved: { label: 'Reserved', color: '#9A6700', background: '#FFF4D9' },
  booked: { label: 'Booked', color: '#5A4BD1', background: '#EDEBFF' },
  pickedUp: { label: 'Picked up', color: '#2867A8', background: '#E6F2FF' },
  cleaning: { label: 'Cleaning', color: '#7851A9', background: '#F2ECFA' },
  repair: { label: 'Repair', color: '#B54708', background: '#FFF0E5' },
};

function formatMoney(value: number) {
  return `₱${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export default function ShopInventoryScreen() {
  const user = auth.currentUser;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'items'), where('shopId', '==', user.uid)),
      (snapshot) => {
        setItems(
          snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
          })) as Item[],
        );
        setLoading(false);
      },
      (error) => {
        console.error('Could not load owner inventory:', error);
        setLoading(false);
        Alert.alert('Inventory unavailable', 'We could not load your listed items.');
      },
    );
  }, [user]);

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
              <Text style={styles.title}>Inventory</Text>
              <Text style={styles.subtitle}>{items.length} pieces listed</Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="shirt-outline" size={22} color={colors.primary} />
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState
              icon="shirt-outline"
              title="Your inventory is empty"
              description="Add a rental item and it will appear here."
            />
          )
        }
        renderItem={({ item }) => {
          const status = statusColors[item.status] ?? statusColors.available;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(`/shop/edit-item/${item.id}` as Href)
              }
            >
              <Card style={styles.itemCard}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoFallback]}>
                    <Ionicons name="shirt-outline" size={27} color={colors.primary} />
                  </View>
                )}
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemType}>{item.type}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{formatMoney(item.price)}<Text style={styles.day}> / day</Text></Text>
                    <View style={[styles.badge, { backgroundColor: status.background }]}>
                      <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.deposit}>Deposit {formatMoney(item.deposit)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Card>
            </Pressable>
          );
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add new item"
        onPress={() => router.push('/shop/add-item' as Href)}
        style={styles.fab}
      >
        <Ionicons name="add" size={27} color="#FFFFFF" />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 17 },
  list: { flexGrow: 1, paddingTop: 21, paddingBottom: 94 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 19,
  },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { marginTop: 54 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    marginBottom: 11,
  },
  photo: {
    width: 72,
    height: 82,
    borderRadius: 12,
    backgroundColor: colors.lavender,
  },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  itemDetails: { flex: 1, minWidth: 0, paddingHorizontal: 12, gap: 4 },
  itemName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  itemType: { color: colors.muted, fontSize: 11 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  price: { color: colors.text, fontSize: 13, fontWeight: '800' },
  day: { color: colors.muted, fontSize: 10, fontWeight: '500' },
  badge: { borderRadius: 15, paddingVertical: 4, paddingHorizontal: 7 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  deposit: { color: colors.muted, fontSize: 10 },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
});
