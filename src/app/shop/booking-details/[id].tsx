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

import { auth, db } from '../../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';
import type { Booking } from '@/types';

function money(value: number) {
  return `₱${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export default function ShopBookingDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = auth.currentUser;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [lateFee, setLateFee] = useState('');
  const [damageFee, setDamageFee] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notOwned, setNotOwned] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    return onSnapshot(
      doc(db, 'bookings', id),
      (snapshot) => {
        const data = snapshot.data();
        if (!snapshot.exists() || data?.shopId !== user.uid) {
          setNotOwned(true);
          setBooking(null);
        } else {
          setBooking({ id: snapshot.id, ...data } as Booking);
          setNotOwned(false);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Could not load shop booking details:', error);
        setLoading(false);
        Alert.alert('Booking unavailable', 'We could not load this booking.');
      },
    );
  }, [id, user]);

  const changeStatus = async (status: 'confirmed' | 'pickedUp' | 'returned') => {
    if (!id || !booking || !user || booking.shopId !== user.uid) return;
    setSaving(true);
    try {
      if (status === 'returned') {
        const parsedLate = lateFee.trim() ? Number(lateFee) : 0;
        const parsedDamage = damageFee.trim() ? Number(damageFee) : 0;
        if (
          !Number.isFinite(parsedLate) ||
          parsedLate < 0 ||
          !Number.isFinite(parsedDamage) ||
          parsedDamage < 0
        ) {
          Alert.alert('Check additional fees', 'Fees must be valid non-negative amounts.');
          return;
        }
        await updateDoc(doc(db, 'bookings', id), {
          status,
          lateFee: (booking.lateFee ?? 0) + parsedLate,
          damageFee: ((booking as Booking & { damageFee?: number }).damageFee ?? 0) + parsedDamage,
          total: (booking.total ?? 0) + parsedLate + parsedDamage,
        });
      } else {
        await updateDoc(doc(db, 'bookings', id), { status });
      }
      Alert.alert(
        'Booking updated',
        status === 'confirmed'
          ? 'The booking has been confirmed.'
          : status === 'pickedUp'
            ? 'The rental has been marked as picked up.'
            : 'The rental has been marked as returned.',
      );
      if (status === 'returned') router.back();
    } catch (error) {
      console.error('Could not change shop booking status:', error);
      Alert.alert('Booking not updated', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }
  if (notOwned || !booking) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.notFound}>This booking is not available in your shop.</Text>
      </Screen>
    );
  }

  const rentalItems = booking.items ?? [];
  const isCompleted = booking.status === 'returned' || booking.status === 'cancelled';

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.eyebrow}>BOOKING DETAILS</Text>
          <Text style={styles.title}>Rental request</Text>
          <Text style={styles.reference}>#{booking.id.slice(0, 10).toUpperCase()}</Text>
        </View>
        <Card style={styles.card}>
          <View style={styles.customerRow}>
            <View style={styles.customerIcon}>
              <Ionicons name="person-outline" size={21} color={colors.primary} />
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.label}>CUSTOMER</Text>
              <Text style={styles.customerName}>{booking.customerName || 'Customer'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.label}>RENTAL DATES</Text>
          <Text style={styles.value}>{booking.startDate} – {booking.endDate}</Text>
        </Card>

        <Text style={styles.sectionTitle}>Items</Text>
        <Card style={styles.card}>
          {rentalItems.length > 0 ? (
            rentalItems.map((item) => (
              <View key={item.itemId} style={styles.itemRow}>
                <View style={styles.itemIcon}>
                  <Ionicons name="shirt-outline" size={19} color={colors.primary} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.muted}>{item.size ? `Size ${item.size} · ` : ''}{money(item.price)} / day</Text>
                </View>
                <Text style={styles.itemDeposit}>{money(item.deposit ?? 0)} deposit</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>Rental details are not available.</Text>
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Booking total</Text>
            <Text style={styles.total}>{money(booking.total ?? 0)}</Text>
          </View>
          {(booking.lateFee ?? 0) > 0 ? (
            <Text style={styles.feeLine}>Late fees included: {money(booking.lateFee ?? 0)}</Text>
          ) : null}
        </Card>

        {!isCompleted && booking.status === 'pending' ? (
          <Button
            title="Confirm booking"
            icon="checkmark-circle-outline"
            loading={saving}
            onPress={() => changeStatus('confirmed')}
            style={styles.action}
          />
        ) : null}
        {!isCompleted && booking.status === 'confirmed' ? (
          <Button
            title="Mark as picked up"
            icon="bag-check-outline"
            loading={saving}
            onPress={() => changeStatus('pickedUp')}
            style={styles.action}
          />
        ) : null}
        {!isCompleted && booking.status === 'pickedUp' ? (
          <Card style={styles.feeCard}>
            <Text style={styles.sectionTitle}>Return and fees</Text>
            <Text style={styles.muted}>
              Add any late or damage fees to the booking total, or leave both at zero.
            </Text>
            <TextField
              label="Late fee (₱)"
              value={lateFee}
              onChangeText={setLateFee}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <TextField
              label="Damage fee (₱)"
              value={damageFee}
              onChangeText={setDamageFee}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <Button
              title="Mark as returned"
              icon="checkmark-done-outline"
              loading={saving}
              onPress={() => changeStatus('returned')}
            />
          </Card>
        ) : null}
        {isCompleted ? (
          <View style={styles.completed}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.completedText}>
              Booking {booking.status === 'returned' ? 'returned' : 'cancelled'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 17 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 22, paddingBottom: 28, gap: 12 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 4 },
  reference: { color: colors.muted, fontSize: 11, marginTop: 4 },
  card: { gap: 11 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  customerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInfo: { gap: 4 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  customerName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 3 },
  value: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  itemDeposit: { color: colors.muted, fontSize: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  total: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  feeLine: { color: colors.muted, fontSize: 11 },
  action: { marginTop: 4 },
  feeCard: { gap: 13, marginTop: 3 },
  completed: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#E7F7EF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completedText: { color: colors.success, fontSize: 14, fontWeight: '700' },
  notFound: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
