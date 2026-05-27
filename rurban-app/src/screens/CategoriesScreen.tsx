import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, SectionList,
  TouchableOpacity, Image, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { fetchCategories, Category } from '../lib/api';
import { COLORS } from '../lib/theme';

const { width: SW } = Dimensions.get('window');
const COLS = 4;
const CARD_W = (SW - 32 - (COLS - 1) * 10) / COLS;

const BG_CYCLE = [
  '#E8F5E9','#FFF3E0','#E3F2FD','#FCE4EC',
  '#F3E5F5','#E0F7FA','#FFFDE7','#F1F8E9',
];

interface Section {
  title: string;
  data: Category[][];   // rows of 4
  image_url?: string;
}

function chunkIntoRows(items: Category[], cols: number): Category[][] {
  const rows: Category[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

export default function CategoriesScreen({ navigation }: { navigation: any }) {
  const [search, setSearch] = useState('');
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const loadData = useCallback(async () => {
    const data = await fetchCategories();
    setAllCategories(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Build grouped sections: parent → children
  const sections: Section[] = useMemo(() => {
    const q = search.toLowerCase();
    const parents = allCategories.filter(c => !c.parent_id);
    const children = allCategories.filter(c => c.parent_id);

    return parents.map(parent => {
      const kids = children.filter(c => c.parent_id === parent.id);
      const filtered = q
        ? kids.filter(k => k.name.toLowerCase().includes(q))
        : kids;
      return {
        title: parent.name,
        image_url: parent.image_url,
        data: chunkIntoRows(filtered, COLS),
      };
    }).filter(s => s.data.length > 0);
  }, [allCategories, search]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Categories</Text>
        {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Ionicons name="search" size={17} color={COLORS.grayLight} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search categories..."
            placeholderTextColor={COLORS.grayLight}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.grayLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row, idx) => idx.toString()}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 90 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadData(); }}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderSectionHeader={({ section }) => (
            <Text style={s.sectionTitle}>{section.title}</Text>
          )}
          renderSectionFooter={() => <View style={s.sectionGap} />}
          renderItem={({ item: row, index: rowIdx, section }) => (
            <View style={s.row}>
              {row.map((cat, colIdx) => {
                const bgIdx = (rowIdx * COLS + colIdx) % BG_CYCLE.length;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={s.card}
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate('CategoryDetail', {
                      categoryId: cat.parent_id ?? cat.id,
                      categoryName: cat.parent_id
                        ? (allCategories.find(p => p.id === cat.parent_id)?.name ?? cat.name)
                        : cat.name,
                      initialSubCatId: cat.parent_id ? cat.id : null,
                    })}
                  >
                    <View style={[s.imgWrap, { backgroundColor: BG_CYCLE[bgIdx] }]}>
                      {cat.image_url ? (
                        <Image
                          source={{ uri: cat.image_url }}
                          style={s.img}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons name="grid-outline" size={28} color={COLORS.primary} />
                      )}
                    </View>
                    <Text style={s.catName} numberOfLines={2}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {/* Fill empty cells in last row */}
              {row.length < COLS &&
                Array(COLS - row.length).fill(null).map((_, i) => (
                  <View key={'empty' + i} style={s.card} />
                ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="grid-outline" size={52} color={COLORS.grayLight} style={{ marginBottom: 12 }} />
              <Text style={s.emptyText}>No categories found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.dark },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg,
    borderRadius: 12, paddingHorizontal: 14, height: 44,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.dark },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 17, fontWeight: '800', color: COLORS.dark,
    paddingTop: 14, paddingBottom: 12,
  },
  sectionGap: { height: 4 },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
  },
  card: {
    width: CARD_W,
    alignItems: 'center',
  },
  imgWrap: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  img: {
    width: CARD_W - 8,
    height: CARD_W - 8,
  },
  catName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 15,
  },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.grayLight, fontWeight: '600' },
});
