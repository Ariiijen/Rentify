import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';

const categories = ['Gown', 'Barong', 'Filipiniana', 'Costume', 'Accessories', 'Other'];
const MAX_FIRESTORE_PHOTO_BASE64_LENGTH = 700_000;

export default function ShopAddItemScreen() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const choosePhoto = async (source: 'library' | 'camera') => {
    try {
      if (source === 'library') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Photo access needed', 'Allow photo library access to choose a gown photo.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera access needed', 'Allow camera access to take an item photo.');
          return;
        }
      }
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.45,
        base64: true,
      };
      const result =
        source === 'library'
          ? await ImagePicker.launchImageLibraryAsync(pickerOptions)
          : await ImagePicker.launchCameraAsync(pickerOptions);
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
      const mimeType = asset.mimeType || 'image/jpeg';
      setPreview(asset.uri);
      setPhotoUrl(`data:${mimeType};base64,${asset.base64}`);
    } catch (error) {
      console.error(`Could not select item photo from ${source}:`, error);
      Alert.alert('Photo unavailable', 'We could not select an item photo.');
    }
  };

  const save = async () => {
    const user = auth.currentUser;
    const parsedPrice = Number(price);
    const parsedDeposit = Number(deposit);
    const sizes = size.split(',').map((entry) => entry.trim()).filter(Boolean);
    if (!user) {
      Alert.alert('Sign in required', 'Sign in as a shop owner to add inventory.');
      return;
    }
    if (!name.trim() || !price.trim() || !deposit.trim() || !size.trim()) {
      Alert.alert('Complete the form', 'Add a name, price, deposit, and size.');
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
      await addDoc(collection(db, 'items'), {
        shopId: user.uid,
        name: name.trim(),
        type: category,
        price: parsedPrice,
        deposit: parsedDeposit,
        size: sizes[0],
        sizes,
        color: color.trim(),
        photoUrl,
        status: 'available',
        createdAt: serverTimestamp(),
      });
      Alert.alert('Item added', 'Your item is now in your inventory.');
      router.replace('/(tabs)/(shop)/inventory' as Href);
    } catch (error) {
      console.error('Could not save shop inventory item:', error);
      Alert.alert('Item not saved', 'We could not add this item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add new item</Text>
        <Text style={styles.subtitle}>Add a piece to your rental collection.</Text>
        <Card style={styles.form}>
          <View style={styles.photoSection}>
            <Text style={styles.label}>Gown photo</Text>
            {preview ? (
              <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={31} color={colors.primary} />
                <Text style={styles.photoText}>Add Gown Photo</Text>
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
            <Text style={styles.photoNote}>
              Development mode stores a compressed Base64 image in Firestore. Use hosted image URLs for production.
            </Text>
          </View>
          <TextField
            label="Item name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Embroidered evening gown"
            maxLength={80}
          />
          <Text style={styles.label}>Category</Text>
          <View style={styles.categories}>
            {categories.map((entry) => {
              const selected = category === entry;
              return (
                <Pressable
                  key={entry}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(entry)}
                  style={[styles.category, selected && styles.categorySelected]}
                >
                  <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                    {entry}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.amountRow}>
            <TextField
              label="Price / day"
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
            <TextField
              label="Deposit"
              value={deposit}
              onChangeText={setDeposit}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>
          <TextField
            label="Size(s)"
            value={size}
            onChangeText={setSize}
            placeholder="e.g. S, M, L (comma-separated)"
            autoCapitalize="characters"
          />
          <TextField
            label="Color"
            value={color}
            onChangeText={setColor}
            placeholder="e.g. Emerald green"
          />
          <Button title="Save item" loading={saving} onPress={save} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 17 },
  content: { paddingTop: 22, paddingBottom: 28, gap: 8 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginBottom: 11 },
  form: { gap: 16 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8 },
  category: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
    borderWidth: 1,
  },
  categorySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  categoryTextSelected: { color: '#FFFFFF' },
  amountRow: { flexDirection: 'row', gap: 11 },
  amountInput: { flex: 1 },
  photoSection: { gap: 10 },
  photoActions: { flexDirection: 'row', gap: 9 },
  photoAction: { flex: 1, minHeight: 44 },
  photoPlaceholder: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 18,
    backgroundColor: colors.lavender,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoText: { color: colors.muted, fontSize: 13 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 18, backgroundColor: colors.lavender },
  photoNote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
});
