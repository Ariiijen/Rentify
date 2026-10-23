import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';

import { db } from '../../../firebaseConfig';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { Item, ItemStatus } from '@/types';

const statusLabels: Record<ItemStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  booked: 'Booked',
  pickedUp: 'Picked up',
  cleaning: 'Cleaning',
};

const statusColors: Record<ItemStatus, { background: string; text: string }> = {
  available: { background: '#E7F7EF', text: '#168653' },
  reserved: { background: '#FFF4D9', text: '#9A6700' },
  booked: { background: '#EDEBFF', text: '#5A4BD1' },
  pickedUp: { background: '#E6F2FF', text: '#2867A8' },
  cleaning: { background: '#F2ECFA', text: '#7851A9' },
};

function formatMoney(value: number) {
  return `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export default function HomeScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    return onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        setItems(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Item[],
        );
        setLoadError(false);
        setLoading(false);
      },
      (error) => {
        console.error('Could not load rental items:', error);
        setLoadError(true);
        setLoading(false);
        Alert.alert('Items unavailable', 'We could not load the rental catalog.');
      },
    );
  }, []);

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>DISCOVER YOUR NEXT LOOK</Text>
              <Text style={styles.title}>Rentify</Text>
              <Text style={styles.subtitle}>Find something special to wear.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a rental item"
              onPress={() => router.push('/(tabs)/add-item')}
              style={styles.addButton}
            >
              <Ionicons name="add" size={25} color="#FFFFFF" />
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading items"
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : (
            <EmptyState
              icon={loadError ? 'cloud-offline-outline' : 'shirt-outline'}
              title={loadError ? 'Catalog could not load' : 'No rentals just yet'}
              description={
                loadError
                  ? 'Check your connection and try again in a moment.'
                  : 'Add the first piece and make it available to the community.'
              }
            />
          )
        }
        renderItem={({ item }) => {
          const status = statusColors[item.status] ?? statusColors.available;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/item/[id]', params: { id: item.id } })
              }
            >
              <Card style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <View style={styles.itemIcon}>
                    <Ionicons name="shirt-outline" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemType} numberOfLines={1}>{item.type}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: status.background }]}>
                    <Text style={[styles.badgeText, { color: status.text }]}>
                      {statusLabels[item.status] ?? statusLabels.available}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.priceRow}>
                  <Text style={styles.price}>
                    {formatMoney(item.price)}<Text style={styles.perDay}> / day</Text>
                  </Text>
                  <Text style={styles.deposit}>Deposit {formatMoney(item.deposit)}</Text>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 18,
  },
  list: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  loader: {
    marginTop: 54,
  },
  itemCard: {
    marginBottom: 13,
    padding: 15,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  itemName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  itemType: {
    color: colors.muted,
    fontSize: 13,
  },
  badge: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 9,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 13,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  price: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  perDay: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  deposit: {
    color: colors.muted,
    fontSize: 12,
  },
});
