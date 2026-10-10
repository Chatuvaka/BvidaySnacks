import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export default function CartScreen({ navigation }: { navigation: NativeStackNavigationProp<any> }) {
  const { cart, cartTotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleConfirmOrder = async () => {
    if (!profile) return;
    if (cart.length === 0) return;

    setLoading(true);
    const qrToken = `QR_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          profile_id: profile.id,
          total: cartTotal,
          qr_token: qrToken,
          status: 'pendiente'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItemsData = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) throw itemsError;

      clearCart();
      Alert.alert('¡Pedido Confirmado!', 'Tu pedido se ha creado con éxito. Revisa la pestaña de pedidos.', [
        { text: 'Genial', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo crear el pedido');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemImageContainer}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="contain" />
        ) : (
          <Ionicons name="fast-food-outline" size={24} color={theme.colors.textLight} />
        )}
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
      </View>
      
      <View style={styles.quantityContainer}>
        <TouchableOpacity 
          style={styles.qtyBtn} 
          onPress={() => item.quantity > 1 ? updateQuantity(item.id, item.quantity - 1) : removeFromCart(item.id)}
        >
          <Ionicons name={item.quantity > 1 ? "remove" : "trash-outline"} size={20} color={item.quantity > 1 ? theme.colors.textDark : theme.colors.danger} />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity 
          style={styles.qtyBtn} 
          onPress={() => updateQuantity(item.id, item.quantity + 1)}
          disabled={item.quantity >= item.stock}
        >
          <Ionicons name="add" size={20} color={item.quantity >= item.stock ? theme.colors.textLight : theme.colors.textDark} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color={theme.colors.textLight} />
          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.emptyText}>Agrega algunos antojos para comenzar.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Ver Catálogo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${cartTotal.toFixed(2)}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]} 
              onPress={handleConfirmOrder}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmar Pedido</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.textDark, marginTop: theme.spacing.m, marginBottom: theme.spacing.s },
  emptyText: { fontSize: 16, color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.l },
  backButton: { backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: theme.borderRadius.pill },
  backButtonText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },
  list: { padding: theme.spacing.m },
  cartItem: { 
    flexDirection: 'row', 
    backgroundColor: theme.colors.white, 
    padding: theme.spacing.s, 
    borderRadius: theme.borderRadius.m, 
    marginBottom: theme.spacing.s, 
    alignItems: 'center', 
    ...theme.shadows.soft 
  },
  itemImageContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#F8F9FA',
    borderRadius: theme.borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: { width: '80%', height: '80%' },
  itemInfo: { flex: 1, marginLeft: theme.spacing.m, marginRight: theme.spacing.s },
  itemName: { fontSize: 16, fontWeight: '600', color: theme.colors.textDark },
  itemPrice: { fontSize: 14, color: theme.colors.primary, fontWeight: 'bold', marginTop: 4 },
  quantityContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.secondary, 
    borderRadius: theme.borderRadius.pill, 
    padding: 4 
  },
  qtyBtn: { 
    width: 32, 
    height: 32, 
    backgroundColor: theme.colors.white, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    ...theme.shadows.soft
  },
  qtyText: { width: 30, textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: theme.colors.textDark },
  footer: { 
    backgroundColor: theme.colors.white, 
    padding: theme.spacing.l, 
    paddingBottom: 40,
    borderTopLeftRadius: theme.borderRadius.l, 
    borderTopRightRadius: theme.borderRadius.l, 
    ...theme.shadows.soft 
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.m },
  totalLabel: { fontSize: 18, color: theme.colors.textMuted },
  totalValue: { fontSize: 28, fontWeight: 'bold', color: theme.colors.textDark },
  confirmBtn: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: theme.borderRadius.pill, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: theme.colors.border },
  confirmBtnText: { color: theme.colors.white, fontSize: 18, fontWeight: 'bold' }
});
