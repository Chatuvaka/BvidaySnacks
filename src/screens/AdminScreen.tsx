import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '../supabase';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';

type OrderItem = { id: string; product_name: string; quantity: number; price: number; };
type Order = { id: string; total: number; status: string; created_at: string; order_items?: OrderItem[]; profile_id: string; worker_id?: string; };
type Product = { id: string; name: string; price: number; stock: number; active: boolean; };
type UserProfile = { id: string; full_name: string; role: string; };

export default function AdminScreen() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Datos
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  // Estados para el Dashboard de Ventas
  const [salesPeriod, setSalesPeriod] = useState<'hoy' | 'semana' | 'mes' | 'todo'>('todo');
  const [salesWorkerFilter, setSalesWorkerFilter] = useState<string>('todos');
  const [dashboardOrders, setDashboardOrders] = useState<Order[]>([]);
  const [dashboardWorkers, setDashboardWorkers] = useState<UserProfile[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Pestaña y filtros
  const [tab, setTab] = useState<'resumen' | 'pedidos' | 'inventario' | 'trabajadores'>('resumen');
  
  // Pedidos
  const [orderFilter, setOrderFilter] = useState<'activos' | 'historial'>('activos');
  const [searchOrder, setSearchOrder] = useState('');
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Modal de stock y detalles
  const [searchProduct, setSearchProduct] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState('');
  const [adjustType, setAdjustType] = useState<'entrada' | 'salida' | 'correccion'>('entrada');
  const [adjustReason, setAdjustReason] = useState('');
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderParticipants, setOrderParticipants] = useState({ cliente: 'Cargando...', trabajador: 'Cargando...' });

  // Equipo
  const [addWorkerModal, setAddWorkerModal] = useState(false);
  const [searchNewWorker, setSearchNewWorker] = useState('');
  const [clientsList, setClientsList] = useState<UserProfile[]>([]);

  useEffect(() => {
    authenticate();
  }, []);

  const authenticate = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      setIsUnlocked(true);
      fetchAllData();
      return;
    }
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Acceso de Administrador' });
    if (auth.success) {
      setIsUnlocked(true);
      fetchAllData();
    }
  };

  const fetchAllData = () => {
    fetchDashboardData();
    fetchActiveOrders();
    fetchProducts();
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    
    // Obtener la lista de trabajadores si aún no la tenemos
    if (dashboardWorkers.length === 0) {
      const { data: wData } = await supabase.from('profiles').select('*').eq('role', 'trabajador');
      setDashboardWorkers(wData || []);
    }

    let query = supabase.from('orders').select('*').eq('status', 'entregado');
    
    // Filtro de Tiempo
    if (salesPeriod === 'hoy') {
      const today = new Date();
      today.setHours(0,0,0,0);
      query = query.gte('created_at', today.toISOString());
    } else if (salesPeriod === 'semana') {
      const week = new Date();
      week.setDate(week.getDate() - 7);
      query = query.gte('created_at', week.toISOString());
    } else if (salesPeriod === 'mes') {
      const month = new Date();
      month.setMonth(month.getMonth() - 1);
      query = query.gte('created_at', month.toISOString());
    }

    // Filtro de Trabajador
    if (salesWorkerFilter !== 'todos') {
      query = query.eq('worker_id', salesWorkerFilter);
    }

    const { data } = await query;
    setDashboardOrders(data || []);
    setLastUpdated(new Date());
    setLoading(false);
  };

  // Efecto para refetch automático cuando cambian los filtros
  useEffect(() => {
    if (isUnlocked && tab === 'resumen') {
      fetchDashboardData();
    }
  }, [salesPeriod, salesWorkerFilter]);

  const fetchActiveOrders = async (filter = orderFilter, search = searchOrder) => {
    setLoading(true);
    let query = supabase.from('orders').select(`*, order_items(*)`).order('created_at', { ascending: false });
    
    if (filter === 'activos') {
      query = query.in('status', ['pendiente', 'listo']);
    }
    
    const { data } = await query;
    // Client-side search for simplicity without complex joins
    let filtered = data || [];
    if (search.trim() !== '') {
      filtered = filtered.filter(o => o.id.includes(search));
    }
    setActiveOrders(filtered);
    setLoading(false);
  };

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase.from('products').select('*').order('stock', { ascending: true });
    if (searchProduct.trim() !== '') {
      query = query.ilike('name', `%${searchProduct}%`);
    }
    const { data } = await query;
    setProducts(data || []);
    setLoading(false);
  };

  const fetchUsers = async () => {
    setLoading(true);
    // Solo mostramos a los trabajadores en la tabla principal
    const { data } = await supabase.from('profiles').select('*').eq('role', 'trabajador').order('full_name');
    setUsers(data || []);
    setLoading(false);
  };

  const searchClients = async (search: string) => {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('*')
      .neq('role', 'trabajador')
      .neq('role', 'administrador')
      .limit(30);

    if (search.trim()) {
      query = query.ilike('full_name', `%${search}%`);
    }
      
    const { data } = await query;
    setClientsList(data || []);
    setLoading(false);
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'trabajador' ? 'cliente' : 'trabajador';
    
    Alert.alert(
      newRole === 'trabajador' ? 'Ascender a Trabajador' : 'Retirar Acceso',
      newRole === 'trabajador' 
        ? '¿Confirmas que deseas darle acceso operativo a este cliente? Podrá cobrar pedidos.'
        : 'Esta cuenta pasará a ser cliente. Conservará su historial pero perderá el acceso al panel operativo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          style: newRole === 'trabajador' ? 'default' : 'destructive',
          onPress: async () => {
            setLoading(true);
            await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
            setLoading(false);
            setAddWorkerModal(false);
            fetchUsers();
            Alert.alert('Éxito', newRole === 'trabajador' ? 'Usuario ascendido a Trabajador.' : 'Acceso retirado correctamente.');
          }
        }
      ]
    );
  };

  const confirmCancelOrder = async () => {
    if (!selectedOrder || !cancelReason.trim()) {
      Alert.alert('Error', 'Debes proporcionar un motivo para la cancelación.');
      return;
    }
    setLoading(true);
    const userSession = await supabase.auth.getSession();
    const adminId = userSession.data.session?.user.id;

    // TODO: En producción, llamar a un Edge Function o usar un RPC para asegurar que el stock se devuelva solo una vez en una sola transacción.
    // Simulamos la grabación del motivo y el estatus.
    await supabase.from('orders').update({ 
      status: 'cancelado',
      cancel_reason: cancelReason,
      cancelled_by: adminId
    }).eq('id', selectedOrder.id);
    
    setLoading(false);
    setCancelModalVisible(false);
    setCancelReason('');
    setSelectedOrder(null);
    fetchActiveOrders();
    Alert.alert('Cancelado', 'El pedido ha sido cancelado y registrado.');
  };

  const openOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    setOrderParticipants({ cliente: 'Cargando...', trabajador: 'Cargando...' });

    // Buscar nombres del cliente y trabajador independientemente para evitar errores de JOIN
    const { data: clientData } = await supabase.from('profiles').select('full_name').eq('id', order.profile_id).maybeSingle();
    
    let workerName = 'Aún no asignado / Sin cobrar';
    if (order.worker_id) {
      const { data: workerData } = await supabase.from('profiles').select('full_name').eq('id', order.worker_id).maybeSingle();
      if (workerData) workerName = workerData.full_name;
    }

    setOrderParticipants({
      cliente: clientData?.full_name || 'Desconocido',
      trabajador: workerName
    });
  };

  const openStockModal = (product: Product) => {
    setEditingProduct(product);
    setNewStock(product.stock.toString());
  };

  const saveStock = async () => {
    if (!editingProduct) return;
    const num = parseInt(newStock);
    if (isNaN(num) || (num <= 0 && adjustType !== 'correccion')) {
      Alert.alert('Error', 'Ingresa una cantidad válida mayor a 0.');
      return;
    }
    if (adjustType === 'correccion' && isNaN(num)) {
       Alert.alert('Error', 'Ingresa una cantidad válida.');
       return;
    }
    if (!adjustReason.trim()) {
      Alert.alert('Error', 'Debes ingresar un motivo para el ajuste.');
      return;
    }

    setLoading(true);
    const userSession = await supabase.auth.getSession();
    const adminId = userSession.data.session?.user.id;

    let finalStock = editingProduct.stock;
    let difference = 0;

    if (adjustType === 'entrada') {
      finalStock += num;
      difference = num;
    } else if (adjustType === 'salida') {
      finalStock -= num;
      difference = -num;
    } else {
      finalStock = num;
      difference = num - editingProduct.stock;
    }

    if (finalStock < 0) {
      Alert.alert('Error', 'El inventario no puede ser negativo.');
      setLoading(false);
      return;
    }

    // Actualizar producto
    await supabase.from('products').update({ stock: finalStock }).eq('id', editingProduct.id);
    
    // Intentar registrar el log (si la tabla ya existe)
    try {
      await supabase.from('inventory_logs').insert({
        product_id: editingProduct.id,
        admin_id: adminId,
        previous_stock: editingProduct.stock,
        new_stock: finalStock,
        difference: difference,
        reason: adjustReason,
        movement_type: adjustType
      });
    } catch(e) {}

    setEditingProduct(null);
    setNewStock('');
    setAdjustReason('');
    setAdjustType('entrada');
    setLoading(false);
    fetchProducts();
    Alert.alert('Éxito', 'Inventario ajustado correctamente.');
  };

  const toggleProductActive = async (productId: string, currentActive: boolean) => {
    setLoading(true);
    await supabase.from('products').update({ active: !currentActive }).eq('id', productId);
    setLoading(false);
    fetchProducts();
  };

  if (!isUnlocked) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={50} color={theme.colors.primary} />
        </View>
        <Text style={styles.lockedText}>Panel de Administración</Text>
        <Text style={styles.lockedSub}>Acceso confidencial</Text>
        
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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Administración</Text>
          <Text style={styles.subtitle}>Supervisión global</Text>
        </View>
        <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.headerLogout}>
          <Ionicons name="log-out-outline" size={24} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, tab === 'resumen' && styles.tabActive]} onPress={() => {setTab('resumen'); fetchDashboardData();}}>
          <Ionicons name="bar-chart" size={18} color={tab === 'resumen' ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'resumen' && styles.tabTextActive]}>Ventas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'pedidos' && styles.tabActive]} onPress={() => {setTab('pedidos'); fetchActiveOrders();}}>
          <Ionicons name="receipt" size={18} color={tab === 'pedidos' ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'pedidos' && styles.tabTextActive]}>Pedidos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'inventario' && styles.tabActive]} onPress={() => {setTab('inventario'); fetchProducts();}}>
          <Ionicons name="cube" size={18} color={tab === 'inventario' ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'inventario' && styles.tabTextActive]}>Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'trabajadores' && styles.tabActive]} onPress={() => {setTab('trabajadores'); fetchUsers();}}>
          <Ionicons name="people" size={18} color={tab === 'trabajadores' ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'trabajadores' && styles.tabTextActive]}>Equipo</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 20 }} />}

      {/* CONTENIDO RESUMEN (DASHBOARD) */}
      {tab === 'resumen' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
            <Text style={styles.sectionTitle}>Última actualización: {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
          </View>
          
          <View style={styles.periodFilterContainer}>
            {['hoy', 'semana', 'mes', 'todo'].map((p) => (
              <TouchableOpacity 
                key={p} 
                style={[styles.periodBtn, salesPeriod === p && styles.periodBtnActive]}
                onPress={() => setSalesPeriod(p as any)}
              >
                <Text style={[styles.periodText, salesPeriod === p && styles.periodTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filtros de Trabajador */}
          <Text style={styles.sectionTitle}>Cajero / Trabajador</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.workerFilterScroll}>
            <TouchableOpacity 
              style={[styles.workerBtn, salesWorkerFilter === 'todos' && styles.workerBtnActive]}
              onPress={() => setSalesWorkerFilter('todos')}
            >
              <Text style={[styles.workerText, salesWorkerFilter === 'todos' && styles.workerTextActive]}>Todos</Text>
            </TouchableOpacity>
            {dashboardWorkers.map((w) => (
              <TouchableOpacity 
                key={w.id} 
                style={[styles.workerBtn, salesWorkerFilter === w.id && styles.workerBtnActive]}
                onPress={() => setSalesWorkerFilter(w.id)}
              >
                <Text style={[styles.workerText, salesWorkerFilter === w.id && styles.workerTextActive]}>{w.full_name.split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tarjeta Principal de Ingresos */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconBox}>
              <Ionicons name="cash" size={32} color={theme.colors.white} />
            </View>
            <Text style={styles.summaryLabel}>Total Cobrado</Text>
            <Text style={styles.summaryTotal}>${dashboardOrders.reduce((acc, o) => acc + o.total, 0).toFixed(2)}</Text>
            <Text style={styles.summarySub}>Excluye pedidos pendientes o cancelados</Text>
          </View>
          
          {/* Métricas Secundarias */}
          <View style={styles.secondaryMetricsRow}>
            <View style={[styles.metricCard, {width: '100%'}]}>
              <Ionicons name="receipt-outline" size={24} color={theme.colors.primary} style={{marginBottom: 8}} />
              <Text style={styles.metricValue}>{dashboardOrders.length}</Text>
              <Text style={styles.metricLabel}>Pedidos Cobrados</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.refreshBtn} onPress={fetchDashboardData}>
            <Ionicons name="refresh" size={20} color={theme.colors.white} style={{marginRight: 8}} />
            <Text style={styles.refreshBtnText}>Refrescar Datos</Text>
          </TouchableOpacity>
          <View style={{height: 40}} />
        </ScrollView>
      )}

      {/* CONTENIDO PEDIDOS */}
      {tab === 'pedidos' && (
        <View style={{ flex: 1 }}>
          <View style={styles.filterContainer}>
            <TouchableOpacity 
              style={[styles.filterBtn, orderFilter === 'activos' && styles.filterBtnActive]} 
              onPress={() => { setOrderFilter('activos'); fetchActiveOrders('activos'); }}
            >
              <Text style={[styles.filterText, orderFilter === 'activos' && styles.filterTextActive]}>Activos</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterBtn, orderFilter === 'historial' && styles.filterBtnActive]} 
              onPress={() => { setOrderFilter('historial'); fetchActiveOrders('historial'); }}
            >
              <Text style={[styles.filterText, orderFilter === 'historial' && styles.filterTextActive]}>Historial Completo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.colors.textMuted} />
            <TextInput 
              style={styles.searchInput}
              placeholder="Buscar por # ID..."
              value={searchOrder}
              onChangeText={(text) => {
                setSearchOrder(text);
                fetchActiveOrders(orderFilter, text);
              }}
            />
          </View>

          <FlatList
            data={activeOrders}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: theme.spacing.m }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-circle" size={60} color={theme.colors.border} />
                <Text style={styles.emptyText}>No hay pedidos encontrados.</Text>
              </View>
            }
            renderItem={({ item }) => {
              // Determinar pago
              let pagoStatus = 'Pago pendiente';
              if (item.status === 'entregado') pagoStatus = 'Pagado';
              if (item.status === 'cancelado') pagoStatus = 'Cancelado';

              return (
                <View style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View style={styles.timeBadge}>
                      <Ionicons name="time-outline" size={14} color={theme.colors.primary} style={{marginRight: 4}} />
                      <Text style={styles.dateText}>{new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                    </View>
                    <View style={{alignItems: 'flex-end'}}>
                      <View style={[
                        styles.statusBadge, 
                        item.status === 'listo' && styles.statusBadgeListo,
                        item.status === 'entregado' && {backgroundColor: '#E8F5E9'},
                        item.status === 'cancelado' && {backgroundColor: '#FFE5E5'}
                      ]}>
                        <Text style={[
                          styles.statusText, 
                          item.status === 'listo' && styles.statusTextListo,
                          item.status === 'entregado' && {color: '#4CAF50'},
                          item.status === 'cancelado' && {color: theme.colors.danger}
                        ]}>OP: {item.status.toUpperCase()}</Text>
                      </View>
                      <Text style={{fontSize: 11, color: pagoStatus === 'Pagado' ? '#4CAF50' : theme.colors.textMuted, marginTop: 4, fontWeight: 'bold'}}>{pagoStatus}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.orderBody}>
                    <Text style={styles.orderTotal}>${item.total.toFixed(2)}</Text>
                    <View style={{flexDirection: 'row', gap: 8}}>
                      <TouchableOpacity style={styles.detailBtn} onPress={() => openOrderDetails(item)}>
                        <Ionicons name="eye-outline" size={18} color={theme.colors.white} style={{marginRight: 4}} />
                        <Text style={styles.detailBtnText}>Detalle</Text>
                      </TouchableOpacity>

                      {item.status !== 'entregado' && item.status !== 'cancelado' && (
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => { setSelectedOrder(item); setCancelModalVisible(true); }}>
                          <Text style={styles.cancelBtnText}>Cancelar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* CONTENIDO INVENTARIO */}
      {tab === 'inventario' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.colors.textMuted} />
            <TextInput 
              style={styles.searchInput}
              placeholder="Buscar producto..."
              value={searchProduct}
              onChangeText={(text) => {
                setSearchProduct(text);
                fetchProducts();
              }}
            />
          </View>
          <FlatList
            data={products}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: theme.spacing.m }}
            renderItem={({ item }) => {
              let badgeColor = theme.colors.secondary;
              let textColor = theme.colors.textDark;
              let label = 'Disponible';
              
              if (!item.active) {
                badgeColor = '#E0E0E0';
                label = 'Pausado';
              } else if (item.stock === 0) {
                badgeColor = '#FFE5E5';
                textColor = theme.colors.danger;
                label = 'Agotado';
              } else if (item.stock < 10) {
                badgeColor = '#FFF4E5';
                textColor = '#FF9800';
                label = 'Pocas exist.';
              }

              return (
                <View style={[styles.productRow, {flexDirection: 'column', alignItems: 'stretch'}, !item.active && styles.productRowInactive]}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <View style={styles.productInfo}>
                      <Text style={[styles.productName, !item.active && styles.productNameInactive]}>{item.name}</Text>
                      <View style={styles.productMeta}>
                        <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
                        <View style={[styles.stockBadge, {backgroundColor: badgeColor}]}>
                          <Text style={[styles.stockText, {color: textColor}]}>{label}: {item.stock}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  
                  <View style={{flexDirection: 'row', gap: 10, marginTop: 15}}>
                    <TouchableOpacity 
                      style={{flexDirection: 'row', alignItems: 'center', backgroundColor: item.active ? '#E8F5E9' : '#FFE5E5', paddingVertical: 10, borderRadius: 8, flex: 1, justifyContent: 'center'}} 
                      onPress={() => toggleProductActive(item.id, item.active)}
                    >
                       <Ionicons name={item.active ? "eye" : "eye-off"} size={16} color={item.active ? '#4CAF50' : theme.colors.danger} />
                       <Text style={{marginLeft: 6, fontSize: 13, fontWeight: 'bold', color: item.active ? '#4CAF50' : theme.colors.danger}}>
                         {item.active ? 'Visible en catálogo' : 'Oculto'}
                       </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.editBtn, {width: 'auto', paddingVertical: 10, flexDirection: 'row', flex: 1, justifyContent: 'center', borderRadius: 8}]} 
                      onPress={() => openStockModal(item)}
                    >
                      <Ionicons name="options-outline" size={16} color={theme.colors.white} style={{marginRight: 6}} />
                      <Text style={{color: theme.colors.white, fontWeight: 'bold', fontSize: 13}}>Ajustar Stock</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* CONTENIDO TRABAJADORES */}
      {tab === 'trabajadores' && (
        <View style={{ flex: 1 }}>
          <View style={{padding: theme.spacing.m}}>
            <TouchableOpacity 
              style={{
                backgroundColor: theme.colors.primary,
                borderRadius: 16,
                padding: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                ...theme.shadows.soft,
                marginBottom: 10
              }} 
              activeOpacity={0.85}
              onPress={() => {setSearchNewWorker(''); searchClients(''); setAddWorkerModal(true);}}
            >
              <View style={{backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12, marginRight: 15}}>
                <Ionicons name="person-add" size={24} color={theme.colors.white} />
              </View>
              <View>
                <Text style={{color: theme.colors.white, fontWeight: 'bold', fontSize: 18, marginBottom: 2}}>Añadir un Trabajador</Text>
                <Text style={{color: 'rgba(255,255,255,0.85)', fontSize: 13}}>Invita a un cliente a tu equipo</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.white} style={{marginLeft: 'auto'}} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={users}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: theme.spacing.m }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={60} color={theme.colors.border} />
                <Text style={styles.emptyText}>No hay trabajadores activos.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.userRow}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.full_name || 'Sin nombre'}</Text>
                  <View style={[styles.roleLabel, styles.roleWorker]}>
                    <Text style={[styles.roleLabelText, {color: theme.colors.primary}]}>TRABAJADOR</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={[styles.roleBtn, styles.roleBtnRemove]}
                  onPress={() => toggleUserRole(item.id, item.role)}
                >
                  <Ionicons name="close-circle" size={18} color={theme.colors.danger} style={{marginRight: 4}} />
                  <Text style={[styles.roleBtnText, {color: theme.colors.danger}]}>Retirar Acceso</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* MODAL INVENTARIO */}
      <Modal visible={!!editingProduct} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, {maxHeight: '90%', padding: 15}]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Ionicons name="cube-outline" size={26} color={theme.colors.primary} />
                <Text style={[styles.modalTitle, {marginTop: 5, fontSize: 20}]}>Ajustar Inventario</Text>
              </View>
              
              <Text style={styles.modalProductName}>{editingProduct?.name}</Text>
              <Text style={{textAlign: 'center', marginBottom: 15, color: theme.colors.textDark}}>Stock actual: <Text style={{fontWeight: 'bold'}}>{editingProduct?.stock}</Text></Text>

              <View style={{flexDirection: 'row', marginBottom: 15, backgroundColor: theme.colors.secondary, borderRadius: 8, padding: 4}}>
                <TouchableOpacity style={[{flex: 1, padding: 8, alignItems: 'center', borderRadius: 6}, adjustType === 'entrada' && {backgroundColor: theme.colors.white}]} onPress={() => setAdjustType('entrada')}>
                  <Text style={{fontWeight: adjustType === 'entrada' ? 'bold' : 'normal', color: adjustType === 'entrada' ? theme.colors.primary : theme.colors.textMuted, fontSize: 13}}>Entrada</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[{flex: 1, padding: 8, alignItems: 'center', borderRadius: 6}, adjustType === 'salida' && {backgroundColor: theme.colors.white}]} onPress={() => setAdjustType('salida')}>
                  <Text style={{fontWeight: adjustType === 'salida' ? 'bold' : 'normal', color: adjustType === 'salida' ? theme.colors.danger : theme.colors.textMuted, fontSize: 13}}>Salida</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[{flex: 1, padding: 8, alignItems: 'center', borderRadius: 6}, adjustType === 'correccion' && {backgroundColor: theme.colors.white}]} onPress={() => setAdjustType('correccion')}>
                  <Text style={{fontWeight: adjustType === 'correccion' ? 'bold' : 'normal', color: adjustType === 'correccion' ? theme.colors.textDark : theme.colors.textMuted, fontSize: 13}}>Corregir</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.stockInput, {marginBottom: 10, padding: 10, fontSize: 20}]}
                keyboardType="number-pad"
                placeholder="Cantidad..."
                value={newStock}
                onChangeText={setNewStock}
              />

              {(() => {
                const num = parseInt(newStock) || 0;
                let expected = editingProduct?.stock || 0;
                
                if (adjustType === 'entrada') {
                  expected += num;
                } else if (adjustType === 'salida') {
                  expected -= num;
                } else if (adjustType === 'correccion' && newStock !== '') {
                  expected = num;
                }

                const textColor = expected < 0 ? theme.colors.danger : theme.colors.primary;
                
                if (newStock !== '' || adjustType === 'correccion') {
                  return (
                    <View style={{backgroundColor: '#F0F4F8', padding: 12, borderRadius: 8, marginBottom: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0'}}>
                      <Text style={{fontSize: 13, color: theme.colors.textMuted, marginBottom: 4}}>Stock teórico resultante</Text>
                      <Text style={{fontSize: 22, fontWeight: 'bold', color: textColor}}>{expected}</Text>
                      {expected < 0 && <Text style={{fontSize: 11, color: theme.colors.danger, marginTop: 4}}>El stock no puede ser negativo</Text>}
                    </View>
                  );
                }
                return null;
              })()}


              <TextInput
                style={[styles.searchInput, {height: 60, marginBottom: 20, backgroundColor: theme.colors.secondary, padding: 10, borderRadius: 8, textAlignVertical: 'top'}]}
                multiline
                placeholder="Motivo del ajuste..."
                value={adjustReason}
                onChangeText={setAdjustReason}
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtnCancel, {paddingVertical: 12}]} onPress={() => {setEditingProduct(null); setAdjustReason('');}}>
                  <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtnSave, {paddingVertical: 12}]} onPress={saveStock}>
                  <Text style={styles.modalBtnSaveText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL DETALLE DE PEDIDO */}
      <Modal visible={!!selectedOrder && !cancelModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {maxHeight: '85%'}]}>
            <View style={styles.modalHeader}>
              <Ionicons name="receipt-outline" size={30} color={theme.colors.primary} />
              <Text style={styles.modalTitle}>Detalle del Pedido</Text>
            </View>
            
            <View style={styles.participantsBox}>
              <View style={styles.participantRow}>
                <Ionicons name="person" size={14} color={theme.colors.textMuted} />
                <Text style={styles.participantText}>Cliente: <Text style={styles.participantName}>{orderParticipants.cliente}</Text></Text>
              </View>
              <View style={styles.participantRow}>
                <Ionicons name="briefcase" size={14} color={theme.colors.textMuted} />
                <Text style={styles.participantText}>Atendió: <Text style={styles.participantName}>{orderParticipants.trabajador}</Text></Text>
              </View>
            </View>

            <View style={styles.ticketDashedLine} />

            <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
              {selectedOrder?.order_items?.map((item) => (
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
              <Text style={styles.ticketTotalLabel}>Total</Text>
              <Text style={styles.ticketTotalValue}>${selectedOrder?.total?.toFixed(2)}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtnCancel, {flex: 1}]} onPress={() => setSelectedOrder(null)}>
                <Text style={styles.modalBtnCancelText}>Cerrar Detalles</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CANCELAR PEDIDO */}
      <Modal visible={cancelModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, {padding: 20}]}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={40} color={theme.colors.danger} />
              <Text style={[styles.modalTitle, {color: theme.colors.danger, marginTop: 10}]}>Cancelar Pedido</Text>
            </View>
            
            <Text style={{textAlign: 'center', marginBottom: 20, color: theme.colors.textDark, fontSize: 15}}>
              ¿Estás seguro de cancelar este pedido por <Text style={{fontWeight: 'bold'}}>${selectedOrder?.total?.toFixed(2)}</Text>?
            </Text>

            <TextInput
              style={[styles.searchInput, {height: 80, backgroundColor: theme.colors.secondary, borderRadius: 12, padding: 15, textAlignVertical: 'top', marginBottom: 25}]}
              placeholder="Escribe el motivo de la cancelación..."
              multiline
              value={cancelReason}
              onChangeText={setCancelReason}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtnCancel, {backgroundColor: theme.colors.secondary}]} onPress={() => {setCancelModalVisible(false); setCancelReason('');}}>
                <Text style={styles.modalBtnCancelText}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnSave, {backgroundColor: theme.colors.danger}]} onPress={confirmCancelOrder}>
                <Text style={styles.modalBtnSaveText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL AGREGAR TRABAJADOR */}
      <Modal visible={addWorkerModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, {maxHeight: '90%', padding: 0, overflow: 'hidden'}]}>
            
            <View style={{padding: 20, paddingBottom: 10, backgroundColor: theme.colors.white}}>
              <View style={[styles.modalHeader, {marginBottom: 15}]}>
                <View style={{backgroundColor: '#E8F5E9', padding: 15, borderRadius: 50, marginBottom: 10}}>
                  <Ionicons name="person-add" size={30} color="#4CAF50" />
                </View>
                <Text style={styles.modalTitle}>Nuevo Trabajador</Text>
                <Text style={{textAlign: 'center', color: theme.colors.textMuted, fontSize: 14, marginTop: 5}}>Busca a un cliente para promoverlo a tu equipo.</Text>
              </View>
              
              <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.secondary, borderRadius: 12, paddingHorizontal: 15, height: 50}}>
                <Ionicons name="search" size={20} color={theme.colors.textMuted} />
                <TextInput 
                  style={{flex: 1, paddingHorizontal: 10, fontSize: 16, color: theme.colors.textDark}}
                  placeholder="Escribe el nombre aquí..."
                  value={searchNewWorker}
                  onChangeText={(text) => {
                    setSearchNewWorker(text);
                    searchClients(text);
                  }}
                />
              </View>
            </View>

            <FlatList 
              data={clientsList}
              keyExtractor={i=>i.id}
              contentContainerStyle={{padding: 20, paddingTop: 10}}
              style={{flexShrink: 1, backgroundColor: '#F8F9FA'}}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={{alignItems: 'center', padding: 30, opacity: 0.6}}>
                  <Ionicons name="search-outline" size={40} color={theme.colors.textMuted} />
                  <Text style={{color: theme.colors.textMuted, textAlign: 'center', marginTop: 10}}>No se encontraron clientes.</Text>
                </View>
              }
              renderItem={({item}) => (
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.white, padding: 15, borderRadius: 12, marginBottom: 10, ...theme.shadows.soft}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                     <View style={{width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12}}>
                        <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>{item.full_name ? item.full_name.charAt(0).toUpperCase() : 'U'}</Text>
                     </View>
                     <View style={{flex: 1, paddingRight: 10}}>
                        <Text style={{fontSize: 15, fontWeight: 'bold', color: theme.colors.textDark}} numberOfLines={1}>{item.full_name || 'Sin nombre'}</Text>
                        <Text style={{fontSize: 12, color: theme.colors.textMuted}}>Cliente</Text>
                     </View>
                  </View>
                  <TouchableOpacity style={{backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20}} onPress={() => toggleUserRole(item.id, item.role)}>
                    <Text style={{color: 'white', fontWeight: 'bold', fontSize: 12}}>Promover</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            
            <View style={{padding: 15, backgroundColor: theme.colors.white, borderTopWidth: 1, borderTopColor: theme.colors.secondary}}>
              <TouchableOpacity style={{backgroundColor: '#FFE5E5', paddingVertical: 14, borderRadius: 25, alignItems: 'center'}} onPress={() => setAddWorkerModal(false)}>
                <Text style={{color: theme.colors.danger, fontWeight: 'bold', fontSize: 15}}>Cancelar</Text>
              </TouchableOpacity>
            </View>

          </KeyboardAvoidingView>
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
  
  tabsContainer: { flexDirection: 'row', backgroundColor: theme.colors.white, paddingHorizontal: theme.spacing.m, paddingTop: theme.spacing.s, ...theme.shadows.soft },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: theme.colors.primary, fontWeight: 'bold' },
  
  content: { padding: theme.spacing.m },
  summaryCard: { backgroundColor: theme.colors.textDark, padding: theme.spacing.xl, borderRadius: theme.borderRadius.l, alignItems: 'center', marginBottom: theme.spacing.l, ...theme.shadows.soft },
  summaryIconBox: { width: 60, height: 60, backgroundColor: theme.colors.primary, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  summaryLabel: { fontSize: 16, color: theme.colors.white, marginBottom: 5, fontWeight: '500' },
  summaryTotal: { fontSize: 42, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 10 },
  summarySub: { fontSize: 12, color: theme.colors.textMuted },
  
  refreshBtn: { backgroundColor: theme.colors.primary, flexDirection: 'row', paddingVertical: 16, borderRadius: theme.borderRadius.pill, alignItems: 'center', justifyContent: 'center', marginHorizontal: theme.spacing.xl },
  refreshBtnText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },
  
  orderCard: { backgroundColor: theme.colors.white, padding: theme.spacing.l, borderRadius: theme.borderRadius.l, marginBottom: theme.spacing.m, ...theme.shadows.soft },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.pill },
  dateText: { color: theme.colors.textDark, fontWeight: '500', fontSize: 13 },
  statusBadge: { backgroundColor: '#FFF4E5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.borderRadius.pill },
  statusBadgeListo: { backgroundColor: '#E8F5E9' },
  statusText: { fontWeight: 'bold', color: '#FF9800', fontSize: 12 },
  statusTextListo: { color: '#4CAF50' },
  orderBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTotal: { fontSize: 24, fontWeight: 'bold', color: theme.colors.textDark },
  cancelBtn: { backgroundColor: '#FFE5E5', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, borderRadius: theme.borderRadius.pill, alignItems: 'center' },
  cancelBtnText: { color: theme.colors.danger, fontWeight: 'bold', fontSize: 13 },

  productRow: { flexDirection: 'row', backgroundColor: theme.colors.white, padding: theme.spacing.m, borderRadius: theme.borderRadius.l, marginBottom: theme.spacing.s, alignItems: 'center', ...theme.shadows.soft },
  productRowInactive: { opacity: 0.6, backgroundColor: theme.colors.secondary },
  productInfo: { flex: 1, paddingRight: 10 },
  productName: { fontSize: 16, fontWeight: 'bold', color: theme.colors.textDark, marginBottom: 6 },
  productNameInactive: { textDecorationLine: 'line-through', color: theme.colors.textMuted },
  productMeta: { flexDirection: 'row', alignItems: 'center' },
  productPrice: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 15, marginRight: 15 },
  stockBadge: { backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stockText: { color: theme.colors.textDark, fontSize: 12, fontWeight: 'bold' },
  productActions: { flexDirection: 'row', gap: 8 },
  editBtn: { backgroundColor: theme.colors.textDark, width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  toggleBtn: { backgroundColor: theme.colors.danger, width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  toggleBtnActivate: { backgroundColor: '#4CAF50' },

  lockedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: 20 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center', marginBottom: 20, ...theme.shadows.soft },
  lockedText: { fontSize: 28, fontWeight: 'bold', color: theme.colors.textDark, marginBottom: 5 },
  lockedSub: { fontSize: 16, color: theme.colors.textMuted, marginBottom: 40 },
  authBtn: { backgroundColor: theme.colors.textDark, flexDirection: 'row', paddingHorizontal: 30, paddingVertical: 16, borderRadius: theme.borderRadius.pill, alignItems: 'center' },
  authBtnText: { color: theme.colors.white, fontSize: 18, fontWeight: 'bold' },
  logoutBtnSmall: { marginTop: 40, padding: 10 },
  logoutBtnTextSmall: { color: theme.colors.danger, fontWeight: 'bold', fontSize: 16 },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: theme.colors.textMuted, fontSize: 16, marginTop: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.m },
  modalContent: { backgroundColor: theme.colors.white, padding: theme.spacing.xl, borderRadius: theme.borderRadius.l, width: '100%', maxWidth: 400, ...theme.shadows.soft },
  modalHeader: { alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: theme.colors.textDark, marginTop: 10 },
  modalProductName: { fontSize: 18, textAlign: 'center', color: theme.colors.primary, fontWeight: 'bold', marginBottom: 20 },
  modalLabel: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 8 },
  stockInput: { backgroundColor: theme.colors.secondary, borderRadius: theme.borderRadius.m, padding: 15, fontSize: 24, textAlign: 'center', fontWeight: 'bold', color: theme.colors.textDark, marginBottom: 25 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  modalBtnCancel: { flex: 1, paddingVertical: 15, borderRadius: theme.borderRadius.pill, backgroundColor: theme.colors.secondary, alignItems: 'center' },
  modalBtnCancelText: { color: theme.colors.textDark, fontWeight: 'bold', fontSize: 16 },
  modalBtnSave: { flex: 1, paddingVertical: 15, borderRadius: theme.borderRadius.pill, backgroundColor: theme.colors.primary, alignItems: 'center' },
  modalBtnSaveText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },

  // Nuevos estilos
  filterContainer: { flexDirection: 'row', padding: theme.spacing.m, backgroundColor: theme.colors.white, borderBottomWidth: 1, borderBottomColor: theme.colors.secondary },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.borderRadius.pill, backgroundColor: theme.colors.secondary, marginHorizontal: 5 },
  filterBtnActive: { backgroundColor: theme.colors.primary },
  filterText: { color: theme.colors.textMuted, fontWeight: 'bold' },
  filterTextActive: { color: theme.colors.white },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.white, margin: theme.spacing.m, paddingHorizontal: theme.spacing.m, borderRadius: theme.borderRadius.pill, ...theme.shadows.soft },
  searchInput: { flex: 1, height: 45, paddingHorizontal: 10, fontSize: 16, color: theme.colors.textDark },
  
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.white, padding: theme.spacing.m, borderRadius: theme.borderRadius.l, marginBottom: theme.spacing.m, ...theme.shadows.soft },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', color: theme.colors.textDark, marginBottom: 5 },
  roleLabel: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleClient: { backgroundColor: theme.colors.secondary },
  roleWorker: { backgroundColor: '#FFF4E5' },
  roleAdmin: { backgroundColor: '#E8F5E9' },
  roleLabelText: { fontSize: 10, fontWeight: 'bold', color: theme.colors.textMuted },
  
  roleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.borderRadius.pill },
  roleBtnAdd: { backgroundColor: theme.colors.primary },
  roleBtnRemove: { backgroundColor: '#FFE5E5' },
  roleBtnText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 12 },

  // Estilos Dashboard
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.textDark, marginBottom: 10, marginTop: 5 },
  periodFilterContainer: { flexDirection: 'row', backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.m, padding: 4, marginBottom: 20, ...theme.shadows.soft },
  periodBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.borderRadius.m },
  periodBtnActive: { backgroundColor: theme.colors.primary },
  periodText: { color: theme.colors.textMuted, fontWeight: '600', fontSize: 13 },
  periodTextActive: { color: theme.colors.white },
  
  workerFilterScroll: { marginBottom: 20 },
  workerBtn: { backgroundColor: theme.colors.white, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.borderRadius.pill, marginRight: 10, borderWidth: 1, borderColor: theme.colors.border },
  workerBtnActive: { backgroundColor: theme.colors.textDark, borderColor: theme.colors.textDark },
  workerText: { color: theme.colors.textDark, fontWeight: '600' },
  workerTextActive: { color: theme.colors.white },

  secondaryMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metricCard: { backgroundColor: theme.colors.white, width: '48%', padding: theme.spacing.m, borderRadius: theme.borderRadius.l, alignItems: 'center', ...theme.shadows.soft },
  metricValue: { fontSize: 24, fontWeight: 'bold', color: theme.colors.textDark },
  metricLabel: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },

  // Estilos Ticket Detalles
  detailBtn: { backgroundColor: theme.colors.textDark, flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, borderRadius: theme.borderRadius.pill, alignItems: 'center' },
  detailBtnText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 13 },
  participantsBox: { backgroundColor: theme.colors.secondary, padding: 10, borderRadius: theme.borderRadius.m, marginTop: 10, width: '100%' },
  participantRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  participantText: { color: theme.colors.textMuted, fontSize: 13 },
  participantName: { color: theme.colors.textDark, fontWeight: 'bold' },
  ticketDashedLine: { height: 1, width: '100%', borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed', marginVertical: 15 },
  itemsList: { width: '100%', marginBottom: 10 },
  ticketItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  ticketItemText: { flex: 1, fontSize: 16, color: theme.colors.textDark },
  ticketQty: { color: theme.colors.textMuted },
  ticketItemPrice: { fontSize: 16, fontWeight: 'bold', color: theme.colors.textDark, marginLeft: 10 },
  ticketTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  ticketTotalLabel: { fontSize: 18, color: theme.colors.textDark, fontWeight: '600' },
  ticketTotalValue: { fontSize: 26, fontWeight: 'bold', color: theme.colors.primary }
});
