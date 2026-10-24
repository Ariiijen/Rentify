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
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { auth, db } from '../../../../firebaseConfig';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { Booking, CartItem } from '@/types';

type BookingDisplayStatus = 'pending' | 'confirmed' | 'ongoing' | 'returned';

const statusStyle: Record<BookingDisplayStatus, { label: string; color: string; background: string }> = {
  pending: { label: 'Pending', color: '#9A6700', background: '#FFF4D9' },
  confirmed: { label: 'Confirmed', color: '#2867A8', background: '#E6F2FF' },
  ongoing: { label: 'Ongoing', color: '#5A4BD1', background: '#EDEBFF' },
  returned: { label: 'Returned', color: '#168653', background: '#E7F7EF' },
};

function getDisplayStatus(booking: Booking): BookingDisplayStatus {
  if (booking.status === 'pending') return 'pending';
  if (booking.status === 'returned') return 'returned';
  if (booking.status === 'ongoing') return 'ongoing';
  const today = new Date().toISOString().slice(0, 10);
  if (booking.endDate < today) return 'returned';
  if (booking.startDate <= today && booking.endDate >= today) return 'ongoing';
  return 'confirmed';
}

function formatMoney(value: number) {
  return `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

function getBookingItems(booking: Booking) {
  return booking.items?.length
    ? booking.items
    : booking.itemId
      ? [{ itemId: booking.itemId, name: 'Rental item' } as CartItem]
      : [];
}

export default function BookingsScreen() {
  const user = auth.currentUser;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'bookings'), where('userId', '==', user.uid)),
      (snapshot) => {
        const results = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Booking[];
        results.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
        setBookings(results);
        setLoading(false);
        setLoadError(false);
      },
      (error) => {
        console.error('Could not load bookings:', error);
        setLoading(false);
        setLoadError(true);
        Alert.alert('Bookings unavailable', 'We could not load your booking history.');
      },
    );
  }, [user]);

  const showReceipt = (booking: Booking) => {
    const rentalItems = getBookingItems(booking);
    const itemSummary = rentalItems.map((item) => `• ${item.name}`).join('\n');
    const status = statusStyle[getDisplayStatus(booking)];
    Alert.alert(
      'Rentify receipt',
      [
        `Booking: ${booking.id}`,
        `Status: ${status.label}`,
        `Dates: ${booking.startDate} to ${booking.endDate}`,
        '',
        itemSummary || 'Rental item',
        '',
        `Total: ${formatMoney(booking.total ?? 0)}`,
      ].join('\n'),
      [{ text: 'Done' }],
    );
  };

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={bookings}
        keyExtractor={(booking) => booking.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR RENTALS</Text>
            <Text style={styles.title}>Bookings</Text>
            <Text style={styles.subtitle}>Track your requests and rental dates.</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState
              icon={loadError ? 'cloud-offline-outline' : 'calendar-outline'}
              title={loadError ? 'Bookings could not load' : 'No bookings yet'}
              description={
                loadError
                  ? 'Please check your connection and try again.'
                  : 'Your rental requests and receipts will appear here.'
              }
            />
          )
        }
        renderItem={({ item }) => {
          const status = statusStyle[getDisplayStatus(item)];
          const names = getBookingItems(item).map((rentalItem) => rentalItem.name);
          return (
            <Card style={styles.bookingCard}>
              <View style={styles.cardHeader}>
                <View style={styles.bookingIcon}>
                  <Ionicons name="receipt-outline" size={21} color={colors.primary} />
                </View>
                <View style={styles.bookingMain}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>
                    {names.length > 0 ? names.join(', ') : 'Rental booking'}
                  </Text>
                  <Text style={styles.bookingId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: status.background }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailsRow}>
                <View style={styles.dateInfo}>
                  <Ionicons name="calendar-outline" size={15} color={colors.muted} />
                  <Text style={styles.dateText}>{item.startDate} – {item.endDate}</Text>
                </View>
                <Text style={styles.total}>{formatMoney(item.total ?? 0)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => showReceipt(item)}
                style={styles.receiptButton}
              >
                <Text style={styles.receiptText}>View receipt</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 17,
  },
  list: {
    paddingTop: 21,
    paddingBottom: 22,
    flexGrow: 1,
    gap: 11,
  },
  header: {
    marginBottom: 7,
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
  bookingCard: {
    padding: 14,
    marginBottom: 11,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookingIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingMain: {
    flex: 1,
    minWidth: 0,
  },
  bookingTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  bookingId: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 3,
  },
  badge: {
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dateInfo: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flex: 1,
  },
  dateText: {
    color: colors.muted,
    fontSize: 11,
  },
  total: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  receiptButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 7,
  },
  receiptText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
