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
import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  where,
  doc,
} from 'firebase/firestore';

import { auth, db } from '../../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { Booking } from '@/types';

function formatMoney(value: number) {
  return `₱${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export default function ShopDashboardScreen() {
  const user = auth.currentUser;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let loadedBookings = false;
    let loadedItems = false;
    const finishLoading = () => {
      if (loadedBookings && loadedItems) setLoading(false);
    };

    const unsubscribeBookings = onSnapshot(
      query(collection(db, 'bookings'), where('shopId', '==', user.uid)),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
          })) as Booking[],
        );
        loadedBookings = true;
        finishLoading();
      },
      (error) => {
        console.error('Could not load shop dashboard bookings:', error);
        loadedBookings = true;
        setLoading(false);
        Alert.alert('Dashboard unavailable', 'We could not load your booking requests.');
      },
    );
    const unsubscribeItems = onSnapshot(
      query(collection(db, 'items'), where('shopId', '==', user.uid)),
      (snapshot) => {
        setItemCount(snapshot.size);
        loadedItems = true;
        finishLoading();
      },
      (error) => {
        console.error('Could not count shop inventory:', error);
        loadedItems = true;
        setLoading(false);
        Alert.alert('Dashboard unavailable', 'We could not load your inventory summary.');
      },
    );

    return () => {
      unsubscribeBookings();
      unsubscribeItems();
    };
  }, [user]);

  const pending = useMemo(
    () => bookings.filter((booking) => booking.status === 'pending'),
    [bookings],
  );
  const outToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return bookings.filter(
      (booking) =>
        booking.status === 'pickedUp' &&
        booking.startDate <= today &&
        booking.endDate >= today,
    ).length;
  }, [bookings]);
  const earnings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === 'returned')
        .reduce((total, booking) => total + (booking.total ?? 0), 0),
    [bookings],
  );

  const updateBooking = async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    setWorkingId(bookingId);
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { status });
    } catch (error) {
      console.error('Could not update booking request:', error);
      Alert.alert('Request not updated', 'Please try again.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={pending.slice(0, 5)}
        keyExtractor={(booking) => booking.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.headingRow}>
              <View>
                <Text style={styles.eyebrow}>SHOP OVERVIEW</Text>
                <Text style={styles.title}>Dashboard</Text>
                <Text style={styles.subtitle}>Here&apos;s what&apos;s happening today.</Text>
              </View>
              <View style={styles.logo}>
                <Ionicons name="storefront-outline" size={23} color={colors.primary} />
              </View>
            </View>
            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#FFF4D9' }]}>
                  <Ionicons name="time-outline" size={19} color="#9A6700" />
                </View>
                <Text style={styles.statValue}>{loading ? '—' : pending.length}</Text>
                <Text style={styles.statLabel}>Pending requests</Text>
              </Card>
              <Card style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#E6F2FF' }]}>
                  <Ionicons name="shirt-outline" size={19} color="#2867A8" />
                </View>
                <Text style={styles.statValue}>{loading ? '—' : outToday}</Text>
                <Text style={styles.statLabel}>Items out today</Text>
              </Card>
              <Card style={[styles.statCard, styles.statWide]}>
                <View style={[styles.statIcon, { backgroundColor: '#E7F7EF' }]}>
                  <Ionicons name="trending-up-outline" size={19} color="#168653" />
                </View>
                <Text style={styles.statValue}>{loading ? '—' : formatMoney(earnings)}</Text>
                <Text style={styles.statLabel}>Completed rental earnings</Text>
              </Card>
            </View>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>New booking requests</Text>
                <Text style={styles.sectionSub}>{pending.length} waiting for your response</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/(shop)/bookings' as Href)}
                style={styles.seeAll}
              >
                <Text style={styles.seeAllText}>See all</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title="All caught up"
              description="New booking requests will appear here."
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.requestCard}>
            <View style={styles.requestTop}>
              <View style={styles.requestIcon}>
                <Ionicons name="person-outline" size={19} color={colors.primary} />
              </View>
              <View style={styles.requestInfo}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {item.customerName || 'Customer'}
                </Text>
                <Text style={styles.requestDates}>{item.startDate} – {item.endDate}</Text>
              </View>
              <Text style={styles.requestTotal}>{formatMoney(item.total ?? 0)}</Text>
            </View>
            <View style={styles.actions}>
              <Button
                title="Decline"
                variant="secondary"
                disabled={workingId === item.id}
                onPress={() => updateBooking(item.id, 'cancelled')}
                style={styles.actionButton}
              />
              <Button
                title="Accept"
                loading={workingId === item.id}
                onPress={() => updateBooking(item.id, 'confirmed')}
                style={styles.actionButton}
              />
            </View>
          </Card>
        )}
        ListFooterComponent={
          !loading ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/(shop)/inventory' as Href)}
              style={styles.inventoryLink}
            >
              <Text style={styles.inventoryLinkTitle}>Your inventory</Text>
              <Text style={styles.inventoryLinkSub}>{itemCount} listed pieces</Text>
              <Ionicons name="arrow-forward" size={19} color={colors.primary} />
            </Pressable>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 17 },
  list: { flexGrow: 1, paddingTop: 21, paddingBottom: 24 },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '46%', padding: 13 },
  statWide: { flexBasis: '100%' },
  statIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { color: colors.text, fontSize: 21, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 3 },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sectionSub: { color: colors.muted, fontSize: 11, marginTop: 4 },
  seeAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  loader: { marginTop: 38 },
  requestCard: { padding: 13, marginBottom: 10 },
  requestTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requestIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: { flex: 1, minWidth: 0 },
  customerName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  requestDates: { color: colors.muted, fontSize: 10, marginTop: 4 },
  requestTotal: { color: colors.text, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 12 },
  actionButton: { flex: 1, minHeight: 44 },
  inventoryLink: {
    minHeight: 66,
    marginTop: 7,
    paddingHorizontal: 15,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inventoryLinkTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  inventoryLinkSub: { color: colors.muted, fontSize: 11, marginLeft: 'auto', marginRight: 7 },
});
