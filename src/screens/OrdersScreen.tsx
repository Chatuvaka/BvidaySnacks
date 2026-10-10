import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  total: number;
  status: string;
  qr_token: string;
  created_at: string;
  order_items?: OrderItem[];
};

export default function OrdersScreen() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();

    if (!profile) return;

    // Escuchar cambios en tiempo real en la tabla de 'orders' para este cliente
    const ordersSubscription = supabase
      .channel('custom-update-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `profile_id=eq.${profile.id}` },
        (payload) => {
          // Si el trabajador cambia el status, actualizamos la lista inmediatamente
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
    };
  }, [profile]);

  const fetchOrders = async () => {
    setLoading(true);
    if (!profile) return;
    
    // Agregamos order_items a la consulta para traer el detalle de los productos
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setOrders(data || []);
      
      // Si el pedido se marcó como entregado mientras teníamos su modal QR abierto, lo cerramos.
      const hasSelectedTokenDelivered = data?.some(order => order.qr_token === selectedToken && order.status === 'entregado');
      if (hasSelectedTokenDelivered) {
        setSelectedToken(null);
      }
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente': return theme.colors.primary;
      case 'listo': return '#0077B6';
      case 'entregado': return theme.colors.success;
      case 'cancelado': return theme.colors.danger;
      default: return theme.colors.textLight;
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'pendiente': return 'time';
      case 'listo': return 'checkmark-circle';
      case 'entregado': return 'star';
      case 'cancelado': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const renderItem = ({ item }: { item: Order }) => {
    const statusColor = getStatusColor(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
            <Ionicons name={getStatusIcon(item.status)} size={14} color={statusColor} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Detalle del pedido estilo ticket */}
        <View style={styles.itemsContainer}>
          {item.order_items?.map((orderItem) => (
            <View key={orderItem.id} style={styles.itemRow}>
              <View style={styles.itemNameContainer}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {orderItem.product_name} <Text style={styles.itemQty}>({orderItem.quantity}x)</Text>
                </Text>
              </View>
              <Text style={styles.itemPrice}>${(orderItem.price * orderItem.quantity).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.totalText}>Total: ${item.total.toFixed(2)}</Text>
        </View>
        
        {(item.status === 'pendiente' || item.status === 'listo') && (
          <TouchableOpacity style={styles.qrButton} onPress={() => setSelectedToken(item.qr_token)}>
            <Ionicons name="qr-code" size={18} color={theme.colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.qrButtonText}>Mostrar código QR</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={60} color={theme.colors.textLight} />
              <Text style={styles.emptyText}>No tienes pedidos aún.</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selectedToken} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Código de Entrega</Text>
              <TouchableOpacity onPress={() => setSelectedToken(null)}>
                <Ionicons name="close" size={24} color={theme.colors.textDark} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Muestra este código en mostrador para recoger tu pedido.</Text>
            
            <View style={styles.qrWrapper}>
              {selectedToken && (
                <QRCode
                  value={selectedToken}
                  size={220}
                  color={theme.colors.textDark}
                />
              )}
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedToken(null)}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: theme.spacing.m },
  card: { 
    backgroundColor: theme.colors.white, 
    padding: theme.spacing.m, 
    borderRadius: theme.borderRadius.l, 
    marginBottom: theme.spacing.m, 
    ...theme.shadows.soft 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '500' },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: theme.borderRadius.pill 
  },
  statusText: { fontWeight: 'bold', fontSize: 12 },
  
  itemsContainer: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.s,
    borderRadius: theme.borderRadius.s,
    marginBottom: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemNameContainer: { flex: 1, paddingRight: 8 },
  itemName: { fontSize: 14, color: theme.colors.textDark },
  itemQty: { fontWeight: 'bold', color: theme.colors.textMuted },
  itemPrice: { fontSize: 14, fontWeight: '500', color: theme.colors.textDark },

  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12 },
  totalText: { fontSize: 18, fontWeight: 'bold', color: theme.colors.textDark },
  qrButton: { 
    flexDirection: 'row', 
    marginTop: 16, 
    backgroundColor: theme.colors.primary, 
    padding: 12, 
    borderRadius: theme.borderRadius.pill, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  qrButtonText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: theme.colors.textLight, marginTop: 16 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.m },
  modalContent: { backgroundColor: theme.colors.white, padding: theme.spacing.l, borderRadius: theme.borderRadius.l, width: '100%', alignItems: 'center', ...theme.shadows.soft },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.textDark },
  modalSubtitle: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 24, paddingHorizontal: 10 },
  qrWrapper: { padding: 16, backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.m, borderWidth: 1, borderColor: theme.colors.border },
  closeBtn: { marginTop: 32, backgroundColor: theme.colors.textDark, paddingVertical: 14, width: '100%', borderRadius: theme.borderRadius.pill, alignItems: 'center' },
  closeBtnText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 }
});
