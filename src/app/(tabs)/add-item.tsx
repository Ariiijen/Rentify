import { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { db } from '../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';

export default function AddItemScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choosePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow photo library access to preview an item photo.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPreviewUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Could not open the photo library:', error);
      Alert.alert('Photo unavailable', 'We could not open your photo library.');
    }
  };

  const saveItem = async () => {
    const parsedPrice = Number(price);
    const parsedDeposit = Number(deposit);

    if (!name.trim() || !type.trim() || price.trim() === '' || deposit.trim() === '') {
      Alert.alert('Complete the form', 'Enter a name, type, rental price, and deposit.');
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
        name: name.trim(),
        type: type.trim(),
        price: parsedPrice,
        deposit: parsedDeposit,
        photoUrl: '',
        status: 'available',
        createdAt: serverTimestamp(),
      });
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Could not save rental item:', error);
      Alert.alert('Item not saved', 'We could not add this item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>List a rental</Text>
        <Text style={styles.subtitle}>Share a piece with the Rentify community.</Text>

        <Card style={styles.form}>
          <TextField
            label="Item name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Classic evening dress"
            maxLength={80}
          />
          <TextField
            label="Type"
            value={type}
            onChangeText={setType}
            placeholder="e.g. Dresses, Jackets, Accessories"
            maxLength={50}
          />
          <View style={styles.amountRow}>
            <TextField
              label="Rental price / day"
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

          <View style={styles.photoSection}>
            <Text style={styles.photoLabel}>Item photo</Text>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.preview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={30} color={colors.primary} />
                <Text style={styles.photoHint}>Choose a photo to preview</Text>
              </View>
            )}
            <Button
              title={previewUri ? 'Choose another photo' : 'Choose photo'}
              icon="images-outline"
              variant="secondary"
              onPress={choosePhoto}
            />
            <Text style={styles.photoNote}>
              Photos are preview-only for now and are not uploaded.
            </Text>
          </View>

          <Button
            title="Add item"
            loading={saving}
            onPress={saveItem}
            style={styles.submit}
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
  content: {
    paddingTop: 23,
    paddingBottom: 28,
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 15,
  },
  form: {
    gap: 17,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
  },
  amountInput: {
    flex: 1,
  },
  photoSection: {
    gap: 10,
  },
  photoLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  photoPlaceholder: {
    height: 155,
    borderRadius: 14,
    backgroundColor: '#F2F3FA',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoHint: {
    color: colors.muted,
    fontSize: 13,
  },
  preview: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    backgroundColor: colors.lavender,
  },
  photoNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  submit: {
    marginTop: 4,
  },
});
