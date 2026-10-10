import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { supabase } from '../supabase';
import * as LocalAuthentication from 'expo-local-authentication';
import { Accelerometer } from 'expo-sensors';
// import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export default function TestScreen() {
  const [supabaseStatus, setSupabaseStatus] = useState<string>('Esperando prueba...');
  const [bioStatus, setBioStatus] = useState<string>('Esperando prueba...');
  const [accelData, setAccelData] = useState<{ x: number; y: number; z: number } | null>(null);
  const [accelStatus, setAccelStatus] = useState<string>('Apagado');
  const [pushStatus, setPushStatus] = useState<string>('Esperando prueba... (Requiere EAS Build)');

  // 1. Prueba de Supabase
  const testSupabase = async () => {
    setSupabaseStatus('Probando...');
    try {
      const { data, error } = await supabase.from('_test').select('*').limit(1).maybeSingle();
      if (error && error.code !== '42P01') {
        setSupabaseStatus(`Error: ${error.message}`);
      } else {
        setSupabaseStatus('Conectado a Supabase (Respuesta recibida)');
      }
    } catch (e: any) {
      setSupabaseStatus(`Excepción: ${e.message}`);
    }
  };

  // 2. Prueba Biometría
  const testBiometrics = async () => {
    setBioStatus('Probando...');
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      setBioStatus('Hardware biométrico no disponible');
      return;
    }
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      setBioStatus('No hay biometría registrada en este dispositivo');
      return;
    }
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Autenticación de prueba Bvida',
    });
    if (auth.success) {
      setBioStatus('Autenticación biométrica EXITOSA');
    } else {
      setBioStatus(`Autenticación fallida/cancelada: ${auth.error}`);
    }
  };

  // 3. Prueba Acelerómetro
  useEffect(() => {
    let subscription: any;
    if (accelStatus === 'Escuchando...') {
      Accelerometer.setUpdateInterval(500);
      subscription = Accelerometer.addListener(data => {
        setAccelData(data);
      });
    } else {
      if (subscription) subscription.remove();
      setAccelData(null);
    }
    return () => {
      if (subscription) subscription.remove();
    };
  }, [accelStatus]);

  const toggleAccelerometer = () => {
    if (accelStatus === 'Escuchando...') {
      setAccelStatus('Apagado');
    } else {
      setAccelStatus('Escuchando...');
    }
  };

  // 4. Prueba Notificaciones Push
  const testPush = async () => {
    setPushStatus('Debes usar un EAS Development Build en Android para probar Push.');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Pruebas Tempranas de Hardware</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Conexión a Supabase</Text>
        <Text style={styles.statusText}>{supabaseStatus}</Text>
        <Button title="Probar Supabase" onPress={testSupabase} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Biometría (Huella / FaceID)</Text>
        <Text style={styles.statusText}>{bioStatus}</Text>
        <Button title="Probar Biometría" onPress={testBiometrics} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Acelerómetro (Sugerencias)</Text>
        <Text style={styles.statusText}>Estado: {accelStatus}</Text>
        {accelData && (
          <Text style={styles.statusText}>
            x: {accelData.x.toFixed(2)} y: {accelData.y.toFixed(2)} z: {accelData.z.toFixed(2)}
          </Text>
        )}
        <Button title={accelStatus === 'Escuchando...' ? 'Detener' : 'Probar Acelerómetro'} onPress={toggleAccelerometer} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Notificaciones Push (Expo Token)</Text>
        <Text style={styles.statusText}>{pushStatus}</Text>
        <Button title="Obtener Push Token" onPress={testPush} />
      </View>
      
      <View style={{height: 50}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  section: { marginBottom: 30, padding: 15, backgroundColor: '#f5f5f5', borderRadius: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  statusText: { fontSize: 14, marginBottom: 10, color: '#333' }
});
