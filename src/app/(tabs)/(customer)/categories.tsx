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
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { db } from '../../../../firebaseConfig';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { Item } from '@/types';

const suggestedCategories = [
  { name: 'Gown', icon: 'woman-outline' as const },
  { name: 'Barong', icon: 'shirt-outline' as const },
  { name: 'Filipiniana', icon: 'flower-outline' as const },
  { name: 'Costume', icon: 'sparkles-outline' as const },
  { name: 'Accessories', icon: 'diamond-outline' as const },
];

export default function CustomerCategoriesScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'items'), where('status', '==', 'available')),
      (snapshot) => {
        setItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Item));
        setLoading(false);
      },
      (error) => {
        console.error('Could not load categories:', error);
        setLoading(false);
        Alert.alert('Categories unavailable', 'We could not load rental categories.');
      },
    );
  }, []);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const category = item.type?.trim();
      if (category) counts.set(category.toLowerCase(), (counts.get(category.toLowerCase()) ?? 0) + 1);
    });
    return counts;
  }, [items]);

  const categories = useMemo(() => {
    const values = new Map(suggestedCategories.map((category) => [category.name.toLowerCase(), category]));
    items.forEach((item) => {
      const name = item.type?.trim();
      if (name && !values.has(name.toLowerCase())) {
        values.set(name.toLowerCase(), { name, icon: 'shirt-outline' as const });
      }
    });
    return [...values.values()];
  }, [items]);

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={categories}
        keyExtractor={(category) => category.name}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>DISCOVER RENTALS</Text>
            <Text style={styles.title}>Search by style</Text>
            <Text style={styles.subtitle}>Choose a category to browse the collection.</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState
              icon="grid-outline"
              title="No categories yet"
              description="Available rental categories will appear here."
            />
          )
        }
        renderItem={({ item }) => {
          const count = categoryCounts.get(item.name.toLowerCase()) ?? 0;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/(customer)/browse',
                  params: { category: item.name },
                })
              }
            >
              <Card style={styles.categoryCard}>
                <View style={styles.categoryIcon}>
                  <Ionicons name={item.icon} size={25} color={colors.primary} />
                </View>
                <View style={styles.categoryDetails}>
                  <Text style={styles.categoryName}>{item.name}</Text>
                  <Text style={styles.categoryCount}>
                    {count} {count === 1 ? 'rental' : 'rentals'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
  list: { paddingTop: 22, paddingBottom: 24, flexGrow: 1, gap: 10 },
  header: { marginBottom: 8 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  loader: { marginTop: 50 },
  categoryCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12 },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryDetails: { flex: 1, gap: 4 },
  categoryName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  categoryCount: { color: colors.muted, fontSize: 11 },
});
