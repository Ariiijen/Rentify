import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
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
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';
import type { Item } from '@/types';

const categories = ['All', 'Gown', 'Barong', 'Filipiniana', 'Costume', 'Accessories'];

function formatMoney(value: number) {
  return `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export default function BrowseScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'items'), where('status', '==', 'available')),
      (snapshot) => {
        setItems(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Item[],
        );
        setLoading(false);
        setLoadError(false);
      },
      (error) => {
        console.error('Could not load available items:', error);
        setLoading(false);
        setLoadError(true);
        Alert.alert('Catalog unavailable', 'We could not load rentals right now.');
      },
    );
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        item.type?.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        `${item.name} ${item.type} ${item.color ?? ''} ${item.size ?? ''}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [items, search, selectedCategory]);

  const toggleFavorite = (id: string) => {
    setFavorites((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.heading}>
              <View>
                <Text style={styles.eyebrow}>FIND YOUR NEXT LOOK</Text>
                <Text style={styles.title}>Browse rentals</Text>
                <Text style={styles.subtitle}>Something special is waiting.</Text>
              </View>
              <View style={styles.headingIcon}>
                <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
              </View>
            </View>
            <TextField
              label="Search rentals"
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, type, color..."
              returnKeyType="search"
              style={styles.searchInput}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categories}
            >
              {categories.map((category) => {
                const active = category === selectedCategory;
                return (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedCategory(category)}
                    style={[styles.category, active && styles.categoryActive]}
                  >
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.results}>
              {filteredItems.length} {filteredItems.length === 1 ? 'piece' : 'pieces'} to explore
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : (
            <EmptyState
              icon={loadError ? 'cloud-offline-outline' : 'search-outline'}
              title={loadError ? 'Catalog unavailable' : 'No matches found'}
              description={
                loadError
                  ? 'Please check your connection and try again.'
                  : 'Try another search or browse a different category.'
              }
            />
          )
        }
        renderItem={({ item }) => {
          const favorite = favorites.has(item.id);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${item.name}`}
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
              style={styles.cardWrap}
            >
              <Card style={styles.itemCard}>
                <View style={styles.photoWrap}>
                  {item.photoUrl ? (
                    <Image
                      source={{ uri: item.photoUrl }}
                      style={styles.photo}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.photoFallback}>
                      <Ionicons name="shirt-outline" size={36} color={colors.primary} />
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={favorite ? 'Remove favorite' : 'Add to favorites'}
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleFavorite(item.id);
                    }}
                    style={styles.favorite}
                  >
                    <Ionicons
                      name={favorite ? 'heart' : 'heart-outline'}
                      size={19}
                      color={favorite ? '#E65070' : colors.text}
                    />
                  </Pressable>
                </View>
                <Text style={styles.itemType} numberOfLines={1}>{item.type}</Text>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.price}>
                  {formatMoney(item.price)}<Text style={styles.perDay}> / day</Text>
                </Text>
                <Text style={styles.deposit}>Deposit {formatMoney(item.deposit)}</Text>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
  },
  list: {
    paddingTop: 17,
    paddingBottom: 22,
    flexGrow: 1,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
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
    fontSize: 25,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  headingIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    paddingLeft: 14,
  },
  categories: {
    gap: 8,
    paddingVertical: 16,
  },
  category: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  results: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 11,
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: 10,
  },
  cardWrap: {
    width: '49%',
    marginBottom: 11,
  },
  itemCard: {
    padding: 9,
    height: 247,
  },
  photoWrap: {
    height: 132,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.lavender,
    marginBottom: 10,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favorite: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemType: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  itemName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  price: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 7,
  },
  perDay: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  deposit: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  loader: {
    marginTop: 60,
  },
});
