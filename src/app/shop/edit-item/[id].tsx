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
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

import { auth, db } from '../../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';
import type { ItemStatus } from '@/types';

const itemStatuses: ('available' | 'cleaning' | 'repair')[] = [
  'available',
  'cleaning',
  'repair',
];

export default function EditShopItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = auth.currentUser;
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [status, setStatus] = useState<ItemStatus>('available');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notOwned, setNotOwned] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    return onSnapshot(
      doc(db, 'items', id),
      (snapshot) => {
        const item = snapshot.data();
        if (!snapshot.exists() || item?.shopId !== user.uid) {
          setNotOwned(true);
          setLoading(false);
          return;
        }
        setName(typeof item.name === 'string' ? item.name : '');
        setPrice(String(item.price ?? ''));
        setDeposit(String(item.deposit ?? ''));
        setStatus(
          item.status === 'cleaning' || item.status === 'repair'
            ? item.status
            : 'available',
        );
        setLoading(false);
      },
      (error) => {
        console.error('Could not load shop item for editing:', error);
        setLoading(false);
        Alert.alert('Item unavailable', 'We could not load this item.');
      },
    );
  }, [id, user]);

  const save = async () => {
    if (!id || !user || notOwned) return;
    const parsedPrice = Number(price);
    const parsedDeposit = Number(deposit);
    if (!name.trim() || !price.trim() || !deposit.trim()) {
      Alert.alert('Complete the form', 'Name, price, and deposit are required.');
      return;
    }
    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      !Number.isFinite(parsedDeposit) ||
      parsedDeposit < 0
    ) {
      Alert.alert('Check the amounts', 'Price and deposit must be valid non-negative amounts.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'items', id), {
        name: name.trim(),
        price: parsedPrice,
        deposit: parsedDeposit,
        status,
      });
      Alert.alert('Item updated', 'Your inventory changes have been saved.');
      router.back();
    } catch (error) {
      console.error('Could not update shop item:', error);
      Alert.alert('Changes not saved', 'Please try again.');
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
  if (notOwned) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.errorText}>This item is not in your shop inventory.</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Edit item</Text>
        <Text style={styles.subtitle}>Update your rental listing.</Text>
        <Card style={styles.form}>
          <TextField label="Name" value={name} onChangeText={setName} maxLength={80} />
          <View style={styles.amountRow}>
            <TextField
              label="Price / day"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
            <TextField
              label="Deposit"
              value={deposit}
              onChangeText={setDeposit}
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>
          <Text style={styles.label}>Availability status</Text>
          <View style={styles.statuses}>
            {itemStatuses.map((value) => (
              <Button
                key={value}
                title={value === 'available' ? 'Available' : value === 'cleaning' ? 'Cleaning' : 'Repair'}
                variant={status === value ? 'primary' : 'secondary'}
                onPress={() => setStatus(value)}
                style={styles.statusButton}
              />
            ))}
          </View>
          <Button title="Save changes" loading={saving} onPress={save} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 17 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingTop: 22, paddingBottom: 28, gap: 8 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginBottom: 11 },
  form: { gap: 17 },
  amountRow: { flexDirection: 'row', gap: 11 },
  amountInput: { flex: 1 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  statuses: { flexDirection: 'row', gap: 8 },
  statusButton: { flex: 1, minHeight: 45, paddingHorizontal: 8 },
  errorText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
});
