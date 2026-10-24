import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
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
const MAX_FIRESTORE_PHOTO_BASE64_LENGTH = 700_000;

export default function EditShopItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = auth.currentUser;
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [status, setStatus] = useState<ItemStatus>('available');
  const [photoUrl, setPhotoUrl] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
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
        setPhotoUrl(typeof item.photoUrl === 'string' ? item.photoUrl : '');
        setPreview(typeof item.photoUrl === 'string' && item.photoUrl ? item.photoUrl : null);
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

  const choosePhoto = async (source: 'library' | 'camera') => {
    try {
      if (source === 'library') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Photo access needed', 'Allow photo library access to choose an item photo.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera access needed', 'Allow camera access to take an item photo.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.45,
        base64: true,
      };
      const result =
        source === 'library'
          ? await ImagePicker.launchImageLibraryAsync(options)
          : await ImagePicker.launchCameraAsync(options);
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Photo unavailable', 'We could not encode this image. Try another photo.');
        return;
      }
      if (asset.base64.length > MAX_FIRESTORE_PHOTO_BASE64_LENGTH) {
        Alert.alert(
          'Photo is too large',
          'Choose a smaller or more tightly cropped image. Firestore documents have a size limit.',
        );
        return;
      }
      setPreview(asset.uri);
      setPhotoUrl(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
    } catch (error) {
      console.error(`Could not select item photo from ${source}:`, error);
      Alert.alert('Photo unavailable', 'We could not select an item photo.');
    }
  };

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
          <View style={styles.photoSection}>
            <Text style={styles.label}>Item photo</Text>
            {preview ? (
              <Image source={{ uri: preview }} style={styles.photoPreview} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={30} color={colors.primary} />
                <Text style={styles.photoPlaceholderText}>Add Gown Photo</Text>
              </View>
            )}
            <View style={styles.photoActions}>
              <Button
                title="Gallery"
                icon="images-outline"
                variant="secondary"
                onPress={() => void choosePhoto('library')}
                style={styles.photoAction}
              />
              <Button
                title="Camera"
                icon="camera-outline"
                variant="secondary"
                onPress={() => void choosePhoto('camera')}
                style={styles.photoAction}
              />
            </View>
            {photoUrl ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPhotoUrl('');
                  setPreview(null);
                }}
                style={styles.removePhoto}
              >
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
                <Text style={styles.removePhotoText}>Remove photo</Text>
              </Pressable>
            ) : null}
            <Text style={styles.photoNote}>
              Development mode stores compressed Base64 in Firestore. Use hosted URLs for production.
            </Text>
          </View>
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
  photoSection: { gap: 10 },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: colors.lavender,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: { color: colors.muted, fontSize: 13 },
  photoPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: colors.lavender,
  },
  photoActions: { flexDirection: 'row', gap: 9 },
  photoAction: { flex: 1, minHeight: 44 },
  removePhoto: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  removePhotoText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  photoNote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  statuses: { flexDirection: 'row', gap: 8 },
  statusButton: { flex: 1, minHeight: 45, paddingHorizontal: 8 },
  errorText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
});
