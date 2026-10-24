import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  arrayRemove,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from '../../../../firebaseConfig';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { Item } from '@/types';

function formatMoney(value: number) {
  return `₱${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export default function CustomerWishlistScreen() {
  const user = auth.currentUser;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      async (snapshot) => {
        const wishlist = snapshot.data()?.wishlist;
        const ids = Array.isArray(wishlist)
          ? wishlist.filter((id): id is string => typeof id === 'string')
          : [];
        try {
          const results = await Promise.all(
            ids.map(async (id) => {
              const itemSnapshot = await getDoc(doc(db, 'items', id));
              return itemSnapshot.exists()
                ? ({ id: itemSnapshot.id, ...itemSnapshot.data() } as Item)
                : null;
            }),
          );
          if (active) {
            setItems(results.filter((item): item is Item => item !== null));
            setLoading(false);
          }
        } catch (error) {
          console.error('Could not load wishlist items:', error);
          if (active) {
            setLoading(false);
            Alert.alert('Wishlist unavailable', 'We could not load your saved rentals.');
          }
        }
      },
      (error) => {
        console.error('Could not load customer wishlist:', error);
        if (active) {
          setLoading(false);
          Alert.alert('Wishlist unavailable', 'We could not load your saved rentals.');
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  const removeFromWishlist = async (id: string) => {
    if (!user) return;
    setRemovingId(id);
    try {
      await updateDoc(doc(db, 'users', user.uid), { wishlist: arrayRemove(id) });
    } catch (error) {
      console.error('Could not remove rental from wishlist:', error);
      Alert.alert('Wishlist not updated', 'Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>SAVED FOR LATER</Text>
            <Text style={styles.title}>My Wishlist</Text>
            <Text style={styles.subtitle}>Your favorite pieces, gathered in one place.</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState
              icon="heart-outline"
              title="Your wishlist is waiting"
              description="Save a rental with the heart in Search and it will show up here."
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
          >
            <Card style={styles.itemCard}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Ionicons name="shirt-outline" size={27} color={colors.primary} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemType} numberOfLines={1}>{item.type}</Text>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.price}>{formatMoney(item.price)} / day</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name} from wishlist`}
                disabled={removingId === item.id}
                onPress={(event) => {
                  event.stopPropagation();
                  void removeFromWishlist(item.id);
                }}
                style={styles.removeButton}
              >
                {removingId === item.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="heart" size={21} color={colors.primary} />
                )}
              </Pressable>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 17 },
  list: { flexGrow: 1, paddingTop: 22, paddingBottom: 24, gap: 10 },
  header: { marginBottom: 8 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  loader: { marginTop: 50 },
  itemCard: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 11 },
  photo: { width: 72, height: 82, borderRadius: 12, backgroundColor: colors.peach },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, gap: 4 },
  itemType: { color: colors.primary, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  itemName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  price: { color: colors.text, fontSize: 12, fontWeight: '800' },
  removeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
