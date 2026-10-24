import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';

import { auth, db } from '../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';
import type { Booking } from '@/types';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function BookingScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const accountRole = snapshot.data()?.role;
        setRole(typeof accountRole === 'string' ? accountRole : null);
        setRoleLoading(false);
      },
      (error) => {
        console.error('Could not verify booking access:', error);
        setRoleLoading(false);
        Alert.alert('Booking unavailable', 'We could not verify your account role.');
      },
    );
  }, []);

  const requestBooking = async () => {
    if (role !== 'customer') {
      Alert.alert('Customer account required', 'Only customers can request bookings.');
      return;
    }
    if (!itemId) {
      Alert.alert('Booking unavailable', 'This rental item could not be identified.');
      return;
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      Alert.alert('Check your dates', 'Enter valid dates using YYYY-MM-DD.');
      return;
    }
    if (startDate > endDate) {
      Alert.alert('Check your dates', 'The end date must be on or after the start date.');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to request a booking.');
      return;
    }

    setSaving(true);
    try {
      const existingBookings = await getDocs(
        query(collection(db, 'bookings'), where('itemId', '==', itemId)),
      );
      const overlaps = existingBookings.docs.some((bookingDocument) => {
        const booking = bookingDocument.data() as Pick<
          Booking,
          'status' | 'startDate' | 'endDate'
        >;
        if (booking.status === 'cancelled') return false;
        return startDate <= booking.endDate && endDate >= booking.startDate;
      });

      if (overlaps) {
        Alert.alert(
          'Dates unavailable',
          'This item already has a booking that overlaps those dates. Please choose another range.',
        );
        return;
      }

      await addDoc(collection(db, 'bookings'), {
        itemId,
        userId: user.uid,
        startDate,
        endDate,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      Alert.alert('Request sent', 'Your booking request has been submitted.');
      router.back();
    } catch (error) {
      console.error('Could not request booking:', error);
      Alert.alert('Booking not saved', 'We could not submit your request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.note}>Loading account…</Text>
      </Screen>
    );
  }
  if (role === 'shop') {
    return <Redirect href={'/(tabs)/(shop)/dashboard' as Href} />;
  }
  if (role !== 'customer') {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.note}>A customer account is required to request a booking.</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Choose your dates</Text>
        <Text style={styles.subtitle}>
          Send a request for this rental. The shop will confirm availability.
        </Text>
        <Card style={styles.form}>
          <TextField
            label="Start date"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            autoCapitalize="none"
          />
          <TextField
            label="End date"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            autoCapitalize="none"
          />
          <Text style={styles.note}>
            Dates are checked against existing reservations before your request is saved.
          </Text>
          <Button
            title="Send booking request"
            loading={saving}
            onPress={requestBooking}
          />
        </Card>
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
  },
  content: {
    paddingTop: 26,
    paddingBottom: 28,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  form: {
    gap: 17,
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
