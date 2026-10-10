import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { supabase } from '../supabase';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons name="fast-food" size={50} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>BvidaySnacks</Text>
          <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              placeholderTextColor={theme.colors.textMuted}
              onChangeText={setEmail}
              value={email}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor={theme.colors.textMuted}
              onChangeText={setPassword}
              value={password}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            style={styles.loginBtn} 
            onPress={signInWithEmail} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.loginBtnText}>Ingresar</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Regístrate aquí</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1, padding: theme.spacing.xl, justifyContent: 'center' },
  
  header: { alignItems: 'center', marginBottom: 40 },
  iconBox: { width: 90, height: 90, backgroundColor: theme.colors.white, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 20, ...theme.shadows.soft },
  title: { fontSize: 32, fontWeight: '900', color: theme.colors.textDark, marginBottom: 8 },
  subtitle: { fontSize: 16, color: theme.colors.textMuted },
  
  form: { backgroundColor: theme.colors.white, padding: theme.spacing.xl, borderRadius: theme.borderRadius.l, ...theme.shadows.soft },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.secondary, borderRadius: theme.borderRadius.m, paddingHorizontal: 15, marginBottom: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 55, fontSize: 16, color: theme.colors.textDark },
  
  loginBtn: { backgroundColor: theme.colors.primary, height: 55, borderRadius: theme.borderRadius.pill, justifyContent: 'center', alignItems: 'center', marginTop: 10, ...theme.shadows.medium },
  loginBtnText: { color: theme.colors.white, fontSize: 18, fontWeight: 'bold' },
  
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { color: theme.colors.textMuted, fontSize: 15 },
  registerLink: { color: theme.colors.primary, fontSize: 15, fontWeight: 'bold' }
});
