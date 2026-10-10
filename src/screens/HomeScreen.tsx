import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Alert, TextInput, Dimensions } from 'react-native';
import { supabase } from '../supabase';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Accelerometer } from 'expo-sensors';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
  image_url: string | null;
};

const { width } = Dimensions.get('window');
const cardWidth = (width - theme.spacing.m * 3) / 2;

export default function HomeScreen({ navigation }: { navigation: NativeStackNavigationProp<any> }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<'todos' | 'snack' | 'bebida'>('todos');
  const [search, setSearch] = useState('');
  const { cart, addToCart } = useCart();
  const { profile } = useAuth();
  const [lastShake, setLastShake] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    Accelerometer.setUpdateInterval(500);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const acceleration = Math.sqrt(x * x + y * y + z * z);
      if (acceleration > 2.5) { 
        const now = Date.now();
        if (now - lastShake > 3000) { 
          setLastShake(now);
          suggestRandomProduct();
        }
      }
    });
    return () => subscription.remove();
  }, [products, lastShake, category]);

  const suggestRandomProduct = () => {
    const available = products.filter(p => p.stock > 0 && (category === 'todos' || p.category === category));
    if (available.length > 0) {
      const random = available[Math.floor(Math.random() * available.length)];
      Alert.alert('¡Sugerencia sorpresa!', `¿Qué tal un(a) ${random.name} por $${random.price.toFixed(2)}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Agregar al carrito', onPress: () => addToCart(random) }
      ]);
    } else {
      Alert.alert('Vaya', 'No hay productos disponibles.');
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name');
    
    if (error) {
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p => {
    const matchCategory = category === 'todos' || p.category === category;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });
  
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const renderItem = ({ item }: { item: Product }) => {
    const cartItem = cart.find(c => c.id === item.id);
    const currentQty = cartItem ? cartItem.quantity : 0;
    const isOutOfStock = item.stock <= 0;
    const canAddMore = !isOutOfStock && currentQty < item.stock;

    return (
      <View style={[styles.card, isOutOfStock && styles.cardOutOfStock]}>
        <View style={styles.imageContainer}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="contain" />
          ) : (
            <Ionicons name="fast-food-outline" size={40} color={theme.colors.textLight} />
          )}
          {isOutOfStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>AGOTADO</Text>
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
          
          <TouchableOpacity 
            style={[styles.addButton, !canAddMore && styles.addButtonDisabled]} 
            disabled={!canAddMore}
            onPress={() => addToCart(item)}
          >
            <Ionicons name="add" size={20} color={canAddMore ? theme.colors.white : theme.colors.textLight} />
            <Text style={[styles.addButtonText, !canAddMore && { color: theme.colors.textLight }]}>
              {currentQty > 0 ? `(${currentQty})` : 'Agregar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola{profile?.full_name ? `, ${profile.full_name}` : ','}</Text>
          <Text style={styles.title}>¿Qué se te antoja?</Text>
        </View>
        <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart" size={24} color={theme.colors.white} />
          {totalCartItems > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalCartItems}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textLight} style={styles.searchIcon} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Buscar antojos..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={theme.colors.textLight}
        />
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity style={[styles.filterButton, category === 'todos' && styles.filterButtonActive]} onPress={() => setCategory('todos')}>
          <Text style={[styles.filterText, category === 'todos' && styles.filterTextActive]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterButton, category === 'snack' && styles.filterButtonActive]} onPress={() => setCategory('snack')}>
          <Text style={[styles.filterText, category === 'snack' && styles.filterTextActive]}>Snacks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterButton, category === 'bebida' && styles.filterButtonActive]} onPress={() => setCategory('bebida')}>
          <Text style={[styles.filterText, category === 'bebida' && styles.filterTextActive]}>Bebidas</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="sad-outline" size={60} color={theme.colors.textLight} />
              <Text style={styles.emptyText}>No encontramos ese antojo.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: theme.spacing.m,
    paddingTop: 60,
    paddingBottom: theme.spacing.s,
    backgroundColor: theme.colors.background,
  },
  greeting: { fontSize: 16, color: theme.colors.textMuted },
  title: { fontSize: 24, fontWeight: 'bold', color: theme.colors.textDark },
  cartButton: { 
    backgroundColor: theme.colors.primary, 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: 'center', 
    alignItems: 'center',
    ...theme.shadows.soft
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  cartBadgeText: { color: theme.colors.white, fontSize: 10, fontWeight: 'bold' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.m,
    borderRadius: theme.borderRadius.pill,
    paddingHorizontal: theme.spacing.m,
    height: 48,
    marginBottom: theme.spacing.m,
    ...theme.shadows.soft
  },
  searchIcon: { marginRight: theme.spacing.s },
  searchInput: { flex: 1, height: '100%', fontSize: 16, color: theme.colors.textDark },
  filterContainer: { 
    flexDirection: 'row', 
    paddingHorizontal: theme.spacing.m, 
    marginBottom: theme.spacing.m,
    gap: theme.spacing.s
  },
  filterButton: { 
    paddingVertical: 8, 
    paddingHorizontal: 20, 
    borderRadius: theme.borderRadius.pill, 
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  filterButtonActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { color: theme.colors.textMuted, fontWeight: '600' },
  filterTextActive: { color: theme.colors.white },
  list: { padding: theme.spacing.m, paddingTop: 0, paddingBottom: 100 },
  row: { justifyContent: 'space-between', marginBottom: theme.spacing.m },
  card: { 
    width: cardWidth,
    backgroundColor: theme.colors.white, 
    borderRadius: theme.borderRadius.l, 
    overflow: 'hidden',
    ...theme.shadows.soft
  },
  cardOutOfStock: { opacity: 0.7 },
  imageContainer: {
    width: '100%',
    height: cardWidth,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  image: { width: '80%', height: '80%' },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  outOfStockText: { color: theme.colors.white, fontSize: 10, fontWeight: 'bold' },
  cardContent: { padding: theme.spacing.s },
  productName: { fontSize: 14, fontWeight: '600', color: theme.colors.textDark, height: 40 },
  productPrice: { fontSize: 16, color: theme.colors.primary, fontWeight: 'bold', marginTop: 4, marginBottom: 8 },
  addButton: { 
    flexDirection: 'row',
    backgroundColor: theme.colors.textDark, 
    paddingVertical: 8, 
    borderRadius: theme.borderRadius.pill, 
    alignItems: 'center',
    justifyContent: 'center'
  },
  addButtonDisabled: { backgroundColor: theme.colors.secondary },
  addButtonText: { color: theme.colors.white, fontWeight: 'bold', marginLeft: 4, fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: theme.colors.textLight, marginTop: 16 }
});
