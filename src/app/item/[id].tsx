import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

import { db } from '../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { Item, ItemStatus } from '@/types';

const statuses: ItemStatus[] = [
  'available',
  'reserved',
  'booked',
  'pickedUp',
  'cleaning',
];

const statusLabels: Record<ItemStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  booked: 'Booked',
  pickedUp: 'Picked up',
  cleaning: 'Cleaning',
};

function money(value: number) {
  return `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'items', id),
      (snapshot) => {
        setItem(
          snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as Item)
            : null,
        );
        setLoading(false);
      },
      (error) => {
        console.error('Could not load rental item:', error);
        setLoading(false);
        Alert.alert('Item unavailable', 'We could not load this rental item.');
      },
    );
  }, [id]);

  const updateStatus = async (status: ItemStatus) => {
    if (!id) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'items', id), { status });
    } catch (error) {
      console.error('Could not update item status:', error);
      Alert.alert('Status not updated', 'Please try changing the status again.');
    } finally {
      setUpdating(false);
    }
  };

  if (!id) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.notFound}>This item could not be found.</Text>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (!item) {
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
        <View style={styles.hero}>
          <Ionicons name="shirt-outline" size={72} color={colors.primary} />
        </View>
        <Card style={styles.card}>
          <Text style={styles.type}>{item.type}</Text>
          <Text style={styles.name}>{item.name}</Text>
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
        </Card>

        <Text style={styles.sectionTitle}>Rental status</Text>
        <Text style={styles.statusHint}>Keep availability up to date.</Text>
        <View style={styles.statusGrid}>
          {statuses.map((status) => {
            const selected = status === item.status;
            return (
              <Button
                key={status}
                title={statusLabels[status]}
                variant={selected ? 'primary' : 'secondary'}
                disabled={updating}
                onPress={() => updateStatus(status)}
                style={styles.statusButton}
              />
            );
          })}
        </View>

        <Button
          title="Request a booking"
          icon="calendar-outline"
          disabled={item.status !== 'available'}
          onPress={() =>
            router.push({ pathname: '/booking/[itemId]', params: { itemId: item.id } })
          }
          style={styles.bookButton}
        />
        {item.status !== 'available' ? (
          <Text style={styles.unavailable}>
            This item can be booked when its status is available.
          </Text>
        ) : null}
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
    marginBottom: 11,
  },
  metrics: {
    flexDirection: 'row',
    gap: 14,
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
  bookButton: {
    marginTop: 14,
  },
  unavailable: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  notFound: {
    color: colors.muted,
    fontSize: 15,
  },
});
