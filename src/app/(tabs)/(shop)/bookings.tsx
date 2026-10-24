import { useEffect, useMemo, useState } from 'react';
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
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { auth, db } from '../../../../firebaseConfig';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { Booking } from '@/types';

type BookingFilter = 'Pending' | 'Ongoing' | 'Completed';

const filters: BookingFilter[] = ['Pending', 'Ongoing', 'Completed'];
const badgeColors: Record<string, { label: string; text: string; background: string }> = {
  pending: { label: 'Pending', text: '#9A6700', background: '#FFF4D9' },
  confirmed: { label: 'Confirmed', text: '#2867A8', background: '#E6F2FF' },
  pickedUp: { label: 'Picked up', text: '#5A4BD1', background: '#EDEBFF' },
  returned: { label: 'Returned', text: '#168653', background: '#E7F7EF' },
  cancelled: { label: 'Cancelled', text: '#B54708', background: '#FFF0E5' },
};

function filterBooking(booking: Booking, filter: BookingFilter) {
  if (filter === 'Pending') return booking.status === 'pending';
  if (filter === 'Ongoing') {
    return booking.status === 'confirmed' || booking.status === 'pickedUp';
  }
  return booking.status === 'returned' || booking.status === 'cancelled';
}

function itemNames(booking: Booking) {
  if (booking.items?.length) return booking.items.map((item) => item.name).join(', ');
  return booking.itemId ? 'Rental item' : 'Booking request';
}

function formatMoney(value: number) {
  return `₱${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export default function ShopBookingsScreen() {
  const user = auth.currentUser;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<BookingFilter>('Pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'bookings'), where('shopId', '==', user.uid)),
      (snapshot) => {
        const next = snapshot.docs.map((entry) => ({
          id: entry.id,
          ...entry.data(),
        })) as Booking[];
        next.sort((left, right) => (right.startDate ?? '').localeCompare(left.startDate ?? ''));
        setBookings(next);
        setLoading(false);
      },
      (error) => {
        console.error('Could not load shop bookings:', error);
        setLoading(false);
        Alert.alert('Bookings unavailable', 'We could not load your bookings.');
      },
    );
  }, [user]);

  const visibleBookings = useMemo(
    () => bookings.filter((booking) => filterBooking(booking, filter)),
    [bookings, filter],
  );

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={visibleBookings}
        keyExtractor={(booking) => booking.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>RENTAL ACTIVITY</Text>
            <Text style={styles.title}>Bookings</Text>
            <Text style={styles.subtitle}>Review and manage customer rentals.</Text>
            <View style={styles.filters}>
              {filters.map((value) => {
                const selected = value === filter;
                const count = bookings.filter((booking) => filterBooking(booking, value)).length;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(value)}
                    style={[styles.filter, selected && styles.filterSelected]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                      {value}
                    </Text>
                    <Text style={[styles.filterCount, selected && styles.filterCountSelected]}>
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title={`No ${filter.toLowerCase()} bookings`}
              description="Booking updates will show here in real time."
            />
          )
        }
        renderItem={({ item }) => {
          const status = badgeColors[item.status] ?? badgeColors.pending;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(`/shop/booking-details/${item.id}` as Href)
              }
            >
              <Card style={styles.bookingCard}>
                <View style={styles.topRow}>
                  <View style={styles.icon}>
                    <Ionicons name="receipt-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.summary}>
                    <Text style={styles.customer} numberOfLines={1}>
                      {item.customerName || 'Customer'}
                    </Text>
                    <Text style={styles.name} numberOfLines={1}>{itemNames(item)}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: status.background }]}>
                    <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
                  </View>
                </View>
                <View style={styles.bottomRow}>
                  <Text style={styles.dates}>{item.startDate} – {item.endDate}</Text>
                  <Text style={styles.total}>{formatMoney(item.total ?? 0)}</Text>
                </View>
                <View style={styles.openRow}>
                  <Text style={styles.openText}>View booking</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
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
  screen: { paddingHorizontal: 17 },
  list: { flexGrow: 1, paddingTop: 21, paddingBottom: 24 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  filters: { flexDirection: 'row', gap: 7, marginTop: 18, marginBottom: 14 },
  filter: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  filterTextSelected: { color: '#FFFFFF' },
  filterCount: { color: colors.muted, fontSize: 10 },
  filterCountSelected: { color: '#E8E7FF' },
  loader: { marginTop: 45 },
  bookingCard: { padding: 13, marginBottom: 11 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 41,
    height: 41,
    borderRadius: 14,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { flex: 1, minWidth: 0, gap: 3 },
  customer: { color: colors.text, fontSize: 13, fontWeight: '700' },
  name: { color: colors.muted, fontSize: 11 },
  badge: { borderRadius: 16, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  dates: { color: colors.muted, fontSize: 11 },
  total: { color: colors.text, fontSize: 14, fontWeight: '800' },
  openRow: {
    minHeight: 40,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 7,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  openText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
});
