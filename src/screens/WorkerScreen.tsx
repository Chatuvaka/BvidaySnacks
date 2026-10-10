import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { sendPushNotification } from '../utils/notifications';

type Order = {
  id: string;
  total: number;
  status: string;
  qr_token: string;
  created_at: string;
  worker_id?: string;
  profile_id?: string;
};

export default function WorkerScreen() {
  const { profile, session } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [cashInRegister, setCashInRegister] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, requestPermission] = useCameraPermissions();
  const [manualFolio, setManualFolio] = useState('');
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  
  const [tab, setTab] = useState<'operaciones' | 'caja' | 'perfil'>('operaciones');
  const [workerStats, setWorkerStats] = useState({ total_dinero: 0, posicion: 'N/A', cobrados: 0 });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    authenticate();
  }, []);

  const authenticate = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (!hasHardware || !isEnrolled) {
      setIsUnlocked(true);
      fetchPendingOrders();
      return;
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquea tu panel operativo',
      fallbackLabel: 'Usar contraseña'
    });

    if (auth.success) {
      setIsUnlocked(true);
      fetchPendingOrders();
    } else {
      Alert.alert('Bloqueado', 'Autenticación fallida o cancelada.');
    }
  };

  const fetchPendingOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['pendiente', 'listo'])
      .order('created_at', { ascending: true });

    if (error) console.error(error);
    else setOrders(data || []);
    setLoading(false);
  };

  const fetchTodayRegister = async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'entregado')
      .gte('created_at', todayIso)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDeliveredOrders(data);
      const totalCash = data.reduce((sum, o) => sum + o.total, 0);
      setCashInRegister(totalCash);
    }
    setLoading(false);
  };

  const handleTabChange = (newTab: 'operaciones' | 'caja' | 'perfil') => {
    setTab(newTab);
    if (newTab === 'caja') {
      fetchTodayRegister();
    } else if (newTab === 'operaciones') {
      fetchPendingOrders();
    } else if (newTab === 'perfil') {
      fetchWorkerStats();
    }
  };

  const fetchWorkerStats = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ranking_trabajadores')
      .select('*')
      .eq('profile_id', profile?.id)
      .maybeSingle();

    if (!error && data) {
      setWorkerStats({ 
        total_dinero: data.total_dinero_cobrado, 
        posicion: `#${data.posicion}`,
        cobrados: data.total_pedidos_cobrados
      });
    } else {
      setWorkerStats({ total_dinero: 0, posicion: 'N/A', cobrados: 0 });
    }
    setLoading(false);
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Éxito', 'Tu contraseña ha sido actualizada.');
      setIsChangingPassword(false);
      setNewPassword('');
    }
  };

  const markAsReady = async (orderId: string, profileId?: string) => {
    const { error } = await supabase.from('orders').update({ status: 'listo' }).eq('id', orderId);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      fetchPendingOrders();
      
      if (profileId) {
        // Obtenemos el token del cliente
        const { data: clientProfile } = await supabase.from('profiles').select('push_token').eq('id', profileId).maybeSingle();
        if (clientProfile?.push_token) {
          sendPushNotification(clientProfile.push_token, '¡Tu pedido está listo! 🍿', 'Acércate a recogerlo.');
        }
      }
    }
  };

  const handleScan = async (type: string, data: string) => {
    if (scannedOrder) return;
    setIsScanning(false);
    searchOrderByToken(data);
  };

  const searchOrderByToken = async (token: string) => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('qr_token', token.trim())
        .single();

      if (orderError || !orderData) throw new Error('Pedido no encontrado o código inválido');
      
      if (orderData.status === 'entregado' || orderData.status === 'cancelado') {
        throw new Error(`Este pedido ya fue ${orderData.status}`);
      }

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderData.id);

      setScannedOrder(orderData);
      setOrderItems(itemsData || []);
    } catch (e: any) {
      Alert.alert('Aviso', e.message);
    } finally {
      setLoading(false);
      setManualFolio('');
    }
  };

  const confirmDeliveryAndPayment = async () => {
    if (!scannedOrder) return;
    setLoading(true);
    const { error } = await supabase.from('orders').update({ 
      status: 'entregado',
      worker_id: profile?.id 
    }).eq('id', scannedOrder.id);
    setLoading(false);
    
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Éxito', 'Pago registrado y pedido entregado.');
      setScannedOrder(null);
      setOrderItems([]);
      fetchPendingOrders();
    }
  };

  if (!isUnlocked) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={50} color={theme.colors.primary} />
        </View>
        <Text style={styles.lockedText}>Panel de Trabajador</Text>
        <Text style={styles.lockedSub}>Acceso restringido</Text>
        
        <TouchableOpacity style={styles.authBtn} onPress={authenticate}>
          <Ionicons name="finger-print" size={24} color={theme.colors.white} style={{marginRight: 10}} />
          <Text style={styles.authBtnText}>Desbloquear Panel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtnSmall} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutBtnTextSmall}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isScanning) {
    if (!cameraPermission?.granted) {
      return (
        <View style={styles.lockedContainer}>
          <Ionicons name="camera-outline" size={60} color={theme.colors.textMuted} style={{marginBottom: 20}} />
          <Text style={[styles.lockedText, {fontSize: 20, textAlign: 'center', marginHorizontal: 30}]}>Necesitamos permiso para usar la cámara</Text>
          <TouchableOpacity style={[styles.authBtn, {marginTop: 30}]} onPress={requestPermission}>
            <Text style={styles.authBtnText}>Dar Permiso</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.authBtn, {backgroundColor: theme.colors.danger, marginTop: 15}]} onPress={() => setIsScanning(false)}>
            <Text style={styles.authBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={({ type, data }) => handleScan(type, data)}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.scannerTarget} />
          <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setIsScanning(false)}>
            <Ionicons name="close-circle" size={30} color={theme.colors.white} style={{marginRight: 8}} />
            <Text style={styles.authBtnText}>Cancelar Escaneo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Panel Operativo</Text>
          <Text style={styles.subtitle}>Gestión de pedidos</Text>
        </View>
        <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.headerLogout}>
          <Ionicons name="log-out-outline" size={24} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, tab === 'operaciones' && styles.tabActive]} onPress={() => handleTabChange('operaciones')}>
          <Ionicons name="list" size={18} color={tab === 'operaciones' ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'operaciones' && styles.tabTextActive]}>Cobrar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'caja' && styles.tabActive]} onPress={() => handleTabChange('caja')}>
          <Ionicons name="cash-outline" size={18} color={tab === 'caja' ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'caja' && styles.tabTextActive]}>Caja</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'perfil' && styles.tabActive]} onPress={() => handleTabChange('perfil')}>
          <Ionicons name="person-outline" size={18} color={tab === 'perfil' ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'perfil' && styles.tabTextActive]}>Perfil</Text>
        </TouchableOpacity>
      </View>

      {tab === 'operaciones' && (
        <>
          <View style={styles.scanSection}>
            <TouchableOpacity style={styles.scanBtn} onPress={() => setIsScanning(true)}>
              <Ionicons name="qr-code-outline" size={24} color={theme.colors.white} style={{marginRight: 10}} />
              <Text style={styles.scanBtnText}>Escanear Código QR</Text>
            </TouchableOpacity>
            
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>O</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.manualSection}>
              <View style={styles.inputWrapper}>
                <Ionicons name="keypad-outline" size={20} color={theme.colors.textMuted} style={{marginRight: 10}} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Ingresar token manualmente"
                  placeholderTextColor={theme.colors.textLight}
                  value={manualFolio}
                  onChangeText={setManualFolio}
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity style={styles.manualBtn} onPress={() => searchOrderByToken(manualFolio)}>
                <Ionicons name="search" size={24} color={theme.colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Cola de Pedidos</Text>
            <TouchableOpacity onPress={fetchPendingOrders}>
              <Ionicons name="refresh" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {loading && !scannedOrder ? <ActivityIndicator size="large" color={theme.colors.primary} style={{marginTop: 50}} /> : (
            <FlatList
              data={orders}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-done-circle-outline" size={60} color={theme.colors.border} />
                  <Text style={styles.emptyText}>No hay pedidos pendientes.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.timeBadge}>
                      <Ionicons name="time-outline" size={14} color={theme.colors.primary} style={{marginRight: 4}} />
                      <Text style={styles.dateText}>
                        {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, item.status === 'listo' && styles.statusBadgeListo]}>
                      <Text style={[styles.statusText, item.status === 'listo' && styles.statusTextListo]}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.cardBody}>
                    <View>
                      <Text style={styles.totalLabel}>Total a cobrar</Text>
                      <Text style={styles.totalText}>${item.total.toFixed(2)}</Text>
                    </View>
                    {item.status === 'pendiente' ? (
                      <TouchableOpacity style={styles.readyBtn} onPress={() => markAsReady(item.id, item.profile_id)}>
                        <Ionicons name="checkmark" size={20} color={theme.colors.white} style={{marginRight: 5}} />
                        <Text style={styles.readyBtnText}>Listo</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.waitingBtn}>
                        <Ionicons name="hourglass-outline" size={16} color={theme.colors.primary} style={{marginRight: 5}} />
                        <Text style={styles.waitingText}>Esperando cobro</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            />
          )}
        </>
      )}

      {tab === 'caja' && (
        <View style={styles.cajaContainer}>
          <View style={styles.cashCard}>
            <Text style={styles.cashLabel}>Efectivo esperado en caja (Hoy)</Text>
            <Text style={styles.cashTotal}>${cashInRegister.toFixed(2)}</Text>
            <View style={styles.cashInfoBox}>
              <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
              <Text style={styles.cashInfoText}>{deliveredOrders.length} pedidos entregados hoy</Text>
            </View>
          </View>
          
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Entregas recientes</Text>
            <TouchableOpacity onPress={fetchTodayRegister}>
              <Ionicons name="refresh" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? <ActivityIndicator size="large" color={theme.colors.primary} style={{marginTop: 50}} /> : (
            <FlatList
              data={deliveredOrders}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="sad-outline" size={60} color={theme.colors.border} />
                  <Text style={styles.emptyText}>Aún no has entregado pedidos hoy.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.deliveredCard}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View style={styles.deliveredIcon}>
                      <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                    </View>
                    <View>
                      <Text style={styles.deliveredTime}>{new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                      <Text style={styles.deliveredLabel}>Pedido entregado</Text>
                    </View>
                  </View>
                  <Text style={styles.deliveredAmount}>+${item.total.toFixed(2)}</Text>
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* Pestaña PERFIL DEL TRABAJADOR */}
      {tab === 'perfil' && (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.userCard}>
            <View style={styles.avatarContainer}>
              <Image source={require('../../assets/avatar_trabajador.jpg')} style={styles.avatar} />
            </View>
            <Text style={styles.userName}>{session?.user?.email?.split('@')[0] || 'Cajero'}</Text>
            <Text style={styles.userEmail}>{session?.user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>TRABAJADOR</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Reporte Histórico</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} style={{ marginBottom: 8 }} />
                <Text style={styles.statLabel}>Total Recaudado</Text>
                {loading ? <ActivityIndicator size="small" /> : <Text style={styles.statValue}>${workerStats.total_dinero.toFixed(2)}</Text>}
              </View>
              <View style={styles.statBox}>
                <Ionicons name="trophy-outline" size={24} color={theme.colors.primary} style={{ marginBottom: 8 }} />
                <Text style={styles.statLabel}>Top Cajero</Text>
                {loading ? <ActivityIndicator size="small" /> : <Text style={styles.statValueLarge}>{workerStats.posicion}</Text>}
              </View>
            </View>
          </View>

          <View style={styles.menuContainer}>
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setIsChangingPassword(true)}>
              <View style={styles.menuIconBox}>
                <Ionicons name="lock-closed-outline" size={22} color={theme.colors.textDark} />
              </View>
              <Text style={styles.menuText}>Cambiar Contraseña</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Modal para cambiar contraseña */}
      <Modal visible={isChangingPassword} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <Text style={styles.modalTitle}>Cambiar Contraseña</Text>
            <TextInput 
              style={styles.passwordInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Nueva contraseña (min. 6 letras)"
              placeholderTextColor={theme.colors.textLight}
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIsChangingPassword(false); setNewPassword(''); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdatePassword} disabled={savingPassword}>
                {savingPassword ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.saveBtnText}>Actualizar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal tipo Ticket para cobrar y entregar */}
      <Modal visible={!!scannedOrder} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.ticketHeader}>
              <Ionicons name="receipt-outline" size={40} color={theme.colors.primary} />
              <Text style={styles.modalTitle}>Ticket de Entrega</Text>
            </View>
            
            <View style={styles.ticketDashedLine} />

            <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
              {orderItems.map((item) => (
                <View key={item.id} style={styles.ticketItemRow}>
                  <Text style={styles.ticketItemText} numberOfLines={1}>
                    {item.product_name} <Text style={styles.ticketQty}>(x{item.quantity})</Text>
                  </Text>
                  <Text style={styles.ticketItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.ticketDashedLine} />

            <View style={styles.ticketTotalRow}>
              <Text style={styles.ticketTotalLabel}>Total Efectivo</Text>
              <Text style={styles.ticketTotalValue}>${scannedOrder?.total.toFixed(2)}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmDeliveryAndPayment} disabled={loading}>
                {loading ? <ActivityIndicator color={theme.colors.white}/> : (
                  <>
                    <Ionicons name="cash-outline" size={22} color={theme.colors.white} style={{marginRight: 8}} />
                    <Text style={styles.confirmBtnText}>Cobrar y Entregar</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={() => { setScannedOrder(null); setOrderItems([]); }} disabled={loading}>
                <Text style={styles.closeBtnText}>Cancelar Operación</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.m, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: theme.colors.textDark },
  subtitle: { fontSize: 16, color: theme.colors.textMuted },
  headerLogout: { padding: 10, backgroundColor: '#FFE5E5', borderRadius: theme.borderRadius.m },
  
  tabsContainer: { flexDirection: 'row', backgroundColor: theme.colors.white, paddingHorizontal: theme.spacing.m, paddingTop: theme.spacing.s, marginBottom: theme.spacing.m, ...theme.shadows.soft },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: theme.colors.primary, fontWeight: 'bold' },

  scanSection: { backgroundColor: theme.colors.white, marginHorizontal: theme.spacing.m, padding: theme.spacing.l, borderRadius: theme.borderRadius.l, marginBottom: theme.spacing.l, ...theme.shadows.soft },
  scanBtn: { backgroundColor: theme.colors.textDark, flexDirection: 'row', paddingVertical: 16, borderRadius: theme.borderRadius.pill, alignItems: 'center', justifyContent: 'center' },
  scanBtnText: { color: theme.colors.white, fontSize: 18, fontWeight: 'bold' },
  
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.m },
  line: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { marginHorizontal: 10, color: theme.colors.textLight, fontWeight: 'bold' },

  manualSection: { flexDirection: 'row', alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.secondary, borderRadius: theme.borderRadius.m, paddingHorizontal: theme.spacing.m, marginRight: theme.spacing.m, height: 50 },
  input: { flex: 1, fontSize: 16, color: theme.colors.textDark },
  manualBtn: { backgroundColor: theme.colors.primary, width: 50, height: 50, borderRadius: theme.borderRadius.m, justifyContent: 'center', alignItems: 'center' },
  
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.m, marginBottom: theme.spacing.m },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.textDark },
  
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: theme.colors.textMuted, fontSize: 16, marginTop: 10 },
  
  card: { backgroundColor: theme.colors.white, marginHorizontal: theme.spacing.m, padding: theme.spacing.l, borderRadius: theme.borderRadius.l, marginBottom: theme.spacing.m, ...theme.shadows.soft },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.pill },
  dateText: { color: theme.colors.textDark, fontWeight: '500', fontSize: 13 },
  statusBadge: { backgroundColor: '#FFF4E5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.borderRadius.pill },
  statusBadgeListo: { backgroundColor: '#E8F5E9' },
  statusText: { fontWeight: 'bold', color: '#FF9800', fontSize: 12 },
  statusTextListo: { color: '#4CAF50' },
  
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 2 },
  totalText: { fontSize: 22, fontWeight: 'bold', color: theme.colors.textDark },
  readyBtn: { backgroundColor: theme.colors.primary, flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, borderRadius: theme.borderRadius.pill, alignItems: 'center' },
  readyBtnText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 15 },
  waitingBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.secondary, paddingHorizontal: 15, paddingVertical: 10, borderRadius: theme.borderRadius.pill },
  waitingText: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 13 },

  cajaContainer: { flex: 1 },
  cashCard: { backgroundColor: theme.colors.textDark, padding: theme.spacing.xl, marginHorizontal: theme.spacing.m, borderRadius: theme.borderRadius.l, alignItems: 'center', marginBottom: theme.spacing.l, ...theme.shadows.soft },
  cashLabel: { color: theme.colors.white, fontSize: 16, marginBottom: 10 },
  cashTotal: { color: theme.colors.primary, fontSize: 44, fontWeight: 'bold', marginBottom: 15 },
  cashInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: theme.borderRadius.pill },
  cashInfoText: { color: theme.colors.white, marginLeft: 8, fontWeight: '600' },
  
  deliveredCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.white, marginHorizontal: theme.spacing.m, padding: theme.spacing.m, borderRadius: theme.borderRadius.m, marginBottom: 10, ...theme.shadows.soft },
  deliveredIcon: { width: 40, height: 40, backgroundColor: '#E8F5E9', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  deliveredTime: { fontSize: 16, fontWeight: 'bold', color: theme.colors.textDark },
  deliveredLabel: { fontSize: 13, color: theme.colors.textMuted },
  deliveredAmount: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },

  userCard: { backgroundColor: theme.colors.textDark, padding: theme.spacing.xl, alignItems: 'center', marginHorizontal: theme.spacing.m, borderRadius: theme.borderRadius.l, ...theme.shadows.soft },
  avatarContainer: { width: 90, height: 90, borderRadius: 45, marginBottom: 12, borderWidth: 2, borderColor: theme.colors.white, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  userName: { fontSize: 22, fontWeight: 'bold', color: theme.colors.white },
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  roleBadge: { backgroundColor: theme.colors.white, paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.borderRadius.pill },
  roleText: { color: theme.colors.textDark, fontWeight: '900', fontSize: 10, letterSpacing: 1 },

  statsContainer: { paddingHorizontal: theme.spacing.m, marginTop: theme.spacing.l },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { backgroundColor: theme.colors.white, width: '48%', padding: theme.spacing.m, borderRadius: theme.borderRadius.l, alignItems: 'center', ...theme.shadows.soft },
  statLabel: { fontSize: 13, color: theme.colors.textLight, marginBottom: 5 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: theme.colors.textDark },
  statValueLarge: { fontSize: 26, fontWeight: 'bold', color: theme.colors.primary },

  menuContainer: { backgroundColor: theme.colors.white, margin: theme.spacing.m, borderRadius: theme.borderRadius.l, ...theme.shadows.soft },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.m, borderBottomWidth: 1, borderBottomColor: theme.colors.secondary },
  menuIconBox: { width: 36, height: 36, backgroundColor: theme.colors.secondary, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.m },
  menuText: { flex: 1, fontSize: 16, color: theme.colors.textDark, fontWeight: '500' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContentSmall: { backgroundColor: theme.colors.white, padding: 20, borderRadius: theme.borderRadius.l, ...theme.shadows.soft },
  passwordInput: { backgroundColor: theme.colors.secondary, borderRadius: theme.borderRadius.m, padding: 15, fontSize: 16, marginBottom: 20 },
  cancelBtn: { padding: 10 },
  cancelBtnText: { color: theme.colors.textLight, fontWeight: 'bold', fontSize: 16 },
  saveBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: theme.borderRadius.pill },
  saveBtnText: { color: theme.colors.white, fontWeight: 'bold' },

  lockedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: 20 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center', marginBottom: 20, ...theme.shadows.soft },
  lockedText: { fontSize: 28, fontWeight: 'bold', color: theme.colors.textDark, marginBottom: 5 },
  lockedSub: { fontSize: 16, color: theme.colors.textMuted, marginBottom: 40 },
  authBtn: { backgroundColor: theme.colors.textDark, flexDirection: 'row', paddingHorizontal: 30, paddingVertical: 16, borderRadius: theme.borderRadius.pill, alignItems: 'center' },
  authBtnText: { color: theme.colors.white, fontSize: 18, fontWeight: 'bold' },
  logoutBtnSmall: { marginTop: 40, padding: 10 },
  logoutBtnTextSmall: { color: theme.colors.danger, fontWeight: 'bold', fontSize: 16 },

  cameraOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  scannerTarget: { width: 250, height: 250, borderWidth: 4, borderColor: theme.colors.primary, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  cancelScanBtn: { position: 'absolute', bottom: 50, backgroundColor: theme.colors.danger, flexDirection: 'row', paddingHorizontal: 25, paddingVertical: 15, borderRadius: theme.borderRadius.pill, alignItems: 'center' },

  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.m },
  modalContent: { backgroundColor: theme.colors.white, padding: theme.spacing.xl, borderRadius: theme.borderRadius.l, width: '100%', maxHeight: '80%', ...theme.shadows.soft },
  ticketHeader: { alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: theme.colors.textDark, marginTop: 10 },
  ticketDashedLine: { height: 1, width: '100%', borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed', marginVertical: 15 },
  itemsList: { maxHeight: 200, width: '100%' },
  ticketItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  ticketItemText: { flex: 1, fontSize: 16, color: theme.colors.textDark },
  ticketQty: { color: theme.colors.textMuted },
  ticketItemPrice: { fontSize: 16, fontWeight: 'bold', color: theme.colors.textDark, marginLeft: 10 },
  ticketTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  ticketTotalLabel: { fontSize: 18, color: theme.colors.textDark, fontWeight: '600' },
  ticketTotalValue: { fontSize: 26, fontWeight: 'bold', color: theme.colors.primary },
  modalActions: { width: '100%', gap: theme.spacing.m },
  confirmBtn: { backgroundColor: theme.colors.primary, flexDirection: 'row', paddingVertical: 16, borderRadius: theme.borderRadius.pill, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 18 },
  closeBtn: { paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { color: theme.colors.textLight, fontWeight: 'bold', fontSize: 16 }
});
