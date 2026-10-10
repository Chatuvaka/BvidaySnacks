import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../supabase';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateName = (name: string) => {
    // Validar que haya exactamente 2 palabras separadas por espacios, sin contar espacios extra
    const words = name.trim().split(/\s+/);
    return words.length === 2;
  };

  async function signUpWithEmail() {
    if (!validateName(fullName)) {
      Alert.alert('Nombre inválido', 'Por favor ingresa un nombre y un apellido únicamente (ej. "Juan Pérez").');
      return;
    }

    setLoading(true);
    // Pasamos el full_name en la metadata para que un trigger de Supabase lo pueda tomar
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        }
      }
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Éxito', 'Cuenta creada. Ya puedes iniciar sesión.', [
        { text: 'Ir al Login', onPress: () => navigation.goBack() }
      ]);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="person-add" size={40} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Crear Cuenta</Text>
        <Text style={styles.subtitle}>Únete y pide tus antojos favoritos</Text>

        <TextInput 
          style={styles.input} 
          placeholder="Nombre y Apellido (ej. Juan Pérez)" 
          placeholderTextColor={theme.colors.textLight}
          onChangeText={setFullName} 
          value={fullName} 
          autoCapitalize="words" 
        />

        <TextInput 
          style={styles.input} 
          placeholder="Correo electrónico" 
          placeholderTextColor={theme.colors.textLight}
          onChangeText={setEmail} 
          value={email} 
          autoCapitalize="none" 
          keyboardType="email-address"
        />

        <TextInput 
          style={styles.input} 
          placeholder="Contraseña (mínimo 6 caracteres)" 
          placeholderTextColor={theme.colors.textLight}
          onChangeText={setPassword} 
          value={password} 
          secureTextEntry 
          autoCapitalize="none" 
        />

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={signUpWithEmail} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.buttonText}>Registrarse</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.loginLink}>
          <Text style={styles.loginText}>¿Ya tienes cuenta? <Text style={styles.loginTextBold}>Inicia sesión</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: theme.colors.background, padding: theme.spacing.m },
  card: { backgroundColor: theme.colors.white, padding: theme.spacing.xl, borderRadius: theme.borderRadius.l, ...theme.shadows.soft, alignItems: 'center' },
  iconContainer: { width: 80, height: 80, backgroundColor: theme.colors.secondary, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.m },
  title: { fontSize: 28, fontWeight: 'bold', color: theme.colors.textDark, marginBottom: 8 },
  subtitle: { fontSize: 16, color: theme.colors.textMuted, marginBottom: theme.spacing.xl, textAlign: 'center' },
  input: { width: '100%', height: 50, backgroundColor: theme.colors.secondary, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16, paddingHorizontal: theme.spacing.m, borderRadius: theme.borderRadius.m, fontSize: 16, color: theme.colors.textDark },
  button: { width: '100%', backgroundColor: theme.colors.primary, paddingVertical: 15, borderRadius: theme.borderRadius.pill, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: theme.colors.border },
  buttonText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 18 },
  loginLink: { marginTop: 24 },
  loginText: { color: theme.colors.textMuted, fontSize: 14 },
  loginTextBold: { color: theme.colors.primary, fontWeight: 'bold' }
});
