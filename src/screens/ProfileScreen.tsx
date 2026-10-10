import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Modal, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export default function ProfileScreen() {
  const { profile, session } = useAuth();
  
  const [stats, setStats] = useState({ total: 0, rank: 'N/A' });
  const [loadingStats, setLoadingStats] = useState(true);
  const [name, setName] = useState('Cargando...');
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchUserStats();
      fetchUserName();
    }
  }, [profile]);

  const fetchUserName = async () => {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', profile?.id).single();
    if (data?.full_name) {
      setName(data.full_name);
      setNewName(data.full_name);
    } else {
      setName('Cliente Bviday');
    }
  };

  const handleSaveName = async () => {
    const words = newName.trim().split(/\s+/);
    if (words.length !== 2) {
      Alert.alert('Formato inválido', 'Por favor ingresa exactamente un nombre y un apellido (ej. "Juan Pérez").');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: newName.trim() }).eq('id', profile?.id);
    setSaving(false);
    if (!error) {
      setName(newName.trim());
      setIsEditing(false);
      Alert.alert('Éxito', 'Nombre actualizado correctamente.');
    } else {
      Alert.alert('Error', 'No se pudo actualizar el nombre.');
    }
  };

  const fetchUserStats = async () => {
    setLoadingStats(true);
    const { data, error } = await supabase
      .from('ranking_clientes')
      .select('*')
      .eq('profile_id', profile?.id)
      .maybeSingle();

    if (!error && data) {
      setStats({ 
        total: data.total_gastado, 
        rank: `#${data.posicion}` 
      });
    } else {
      setStats({ total: 0, rank: 'N/A' });
    }
    setLoadingStats(false);
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
      Alert.alert('Éxito', 'Tu contraseña ha sido actualizada correctamente.');
      setIsChangingPassword(false);
      setNewPassword('');
    }
  };

  const getAvatar = () => {
    if (profile?.role === 'administrador') return require('../../assets/avatar_admin.jpg');
    if (profile?.role === 'trabajador') return require('../../assets/avatar_trabajador.jpg');
    return require('../../assets/avatar_cliente.jpg');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Tarjeta principal del usuario */}
      <View style={styles.userCard}>
        <View style={styles.avatarContainer}>
          <Image source={getAvatar()} style={styles.avatar} />
        </View>
        <Text style={styles.userName}>{name}</Text>
        <Text style={styles.userEmail}>{session?.user?.email || profile?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{profile?.role?.toUpperCase()}</Text>
        </View>
      </View>

      {/* Resumen de gastos y ranking */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Reporte de Compras</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} style={{ marginBottom: 8 }} />
            <Text style={styles.statLabel}>Total Gastado</Text>
            {loadingStats ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Text style={styles.statValue}>${stats.total.toFixed(2)}</Text>}
          </View>
          <View style={styles.statBox}>
            <Ionicons name="trophy-outline" size={24} color={theme.colors.primary} style={{ marginBottom: 8 }} />
            <Text style={styles.statLabel}>Ranking Global</Text>
            {loadingStats ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Text style={styles.statValueLarge}>{stats.rank}</Text>}
          </View>
        </View>
      </View>

      {/* Menú de opciones */}
      <Text style={styles.sectionTitle}>Ajustes de Cuenta</Text>
      
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem} onPress={() => setIsEditing(true)}>
          <View style={styles.menuIconBox}>
            <Ionicons name="create-outline" size={22} color={theme.colors.textDark} />
          </View>
          <Text style={styles.menuText}>Editar Nombre</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setIsChangingPassword(true)}>
          <View style={styles.menuIconBox}>
            <Ionicons name="lock-closed-outline" size={22} color={theme.colors.textDark} />
          </View>
          <Text style={styles.menuText}>Cambiar Contraseña</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
        </TouchableOpacity>
      </View>

      {/* Botón Salir */}
      <TouchableOpacity style={styles.logoutBtn} onPress={() => supabase.auth.signOut()}>
        <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} style={{ marginRight: 8 }} />
        <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Bviday Snacks v1.0.0</Text>

      {/* Modal para editar nombre */}
      <Modal visible={isEditing} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Nombre</Text>
            <TextInput 
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Tu nombre completo"
              placeholderTextColor={theme.colors.textLight}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName} disabled={saving}>
                {saving ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para cambiar contraseña */}
      <Modal visible={isChangingPassword} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar Contraseña</Text>
            <TextInput 
              style={styles.input}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  userCard: { 
    backgroundColor: theme.colors.primary, 
    padding: theme.spacing.xl, 
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...theme.shadows.soft,
    zIndex: 2
  },
  avatarContainer: {
    width: 100, height: 100, 
    borderRadius: 50, 
    marginBottom: theme.spacing.m,
    borderWidth: 3,
    borderColor: theme.colors.white,
    overflow: 'hidden',
    backgroundColor: theme.colors.white
  },
  avatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  userName: { fontSize: 24, fontWeight: 'bold', color: theme.colors.white, marginBottom: 4 },
  userEmail: { fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 12 },
  roleBadge: { backgroundColor: theme.colors.white, paddingHorizontal: 16, paddingVertical: 6, borderRadius: theme.borderRadius.pill },
  roleText: { color: theme.colors.primary, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  
  statsContainer: { padding: theme.spacing.m, marginTop: -20, paddingTop: 30, zIndex: 1 },
  statsTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.textDark, marginBottom: theme.spacing.m, marginTop: theme.spacing.m },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statBox: { 
    backgroundColor: theme.colors.white, 
    borderRadius: theme.borderRadius.l, 
    padding: theme.spacing.m, 
    width: '48%',
    marginBottom: theme.spacing.s,
    alignItems: 'center',
    ...theme.shadows.soft
  },
  statBoxFull: { width: '100%', backgroundColor: theme.colors.textDark, marginTop: theme.spacing.xs },
  statLabel: { fontSize: 14, color: theme.colors.textLight, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: theme.colors.textDark },
  statValueLarge: { fontSize: 28, fontWeight: 'bold', color: theme.colors.primary },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.textDark, paddingHorizontal: theme.spacing.m, marginTop: theme.spacing.s, marginBottom: theme.spacing.s },
  menuContainer: { 
    backgroundColor: theme.colors.white, 
    marginHorizontal: theme.spacing.m, 
    borderRadius: theme.borderRadius.l, 
    overflow: 'hidden',
    ...theme.shadows.soft
  },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: theme.spacing.m, 
    borderBottomWidth: 1, 
    borderBottomColor: theme.colors.secondary 
  },
  menuIconBox: { 
    width: 36, height: 36, 
    backgroundColor: theme.colors.secondary, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: theme.spacing.m 
  },
  menuText: { flex: 1, fontSize: 16, color: theme.colors.textDark, fontWeight: '500' },
  
  logoutBtn: { 
    flexDirection: 'row',
    marginHorizontal: theme.spacing.m, 
    marginTop: theme.spacing.xl, 
    marginBottom: theme.spacing.m,
    backgroundColor: '#FFE5E5', 
    paddingVertical: 16, 
    borderRadius: theme.borderRadius.pill, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFB3B3'
  },
  logoutBtnText: { color: theme.colors.danger, fontWeight: 'bold', fontSize: 16 },
  versionText: { textAlign: 'center', color: theme.colors.textLight, fontSize: 12, marginBottom: 40 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.l },
  modalContent: { backgroundColor: theme.colors.white, padding: theme.spacing.l, borderRadius: theme.borderRadius.l, width: '100%', ...theme.shadows.soft },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.textDark, marginBottom: theme.spacing.m },
  input: { backgroundColor: theme.colors.secondary, borderRadius: theme.borderRadius.m, padding: theme.spacing.m, fontSize: 16, color: theme.colors.textDark, marginBottom: theme.spacing.l },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.m },
  cancelBtn: { padding: theme.spacing.m },
  cancelBtnText: { color: theme.colors.textLight, fontWeight: 'bold', fontSize: 16 },
  saveBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: theme.borderRadius.pill, justifyContent: 'center' },
  saveBtnText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 }
});
