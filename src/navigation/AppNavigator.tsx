import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, Button, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import CartScreen from '../screens/CartScreen';
import OrdersScreen from '../screens/OrdersScreen';
import TestScreen from '../screens/TestScreen';
import WorkerScreen from '../screens/WorkerScreen';
import AdminScreen from '../screens/AdminScreen';

import { supabase } from '../supabase';

import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Catálogo') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Mis Pedidos') iconName = focused ? 'receipt' : 'receipt-outline';
          else if (route.name === 'Perfil') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textLight,
        headerStyle: { backgroundColor: theme.colors.white },
        headerTintColor: theme.colors.textDark,
        tabBarStyle: { backgroundColor: theme.colors.white, borderTopWidth: 1, borderTopColor: theme.colors.border },
      })}
    >
      <Tab.Screen name="Catálogo" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Mis Pedidos" component={OrdersScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.colors.white }, headerTintColor: theme.colors.textDark }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Test" component={TestScreen} options={{ title: 'Pruebas Tempranas' }} />
          </>
        ) : (
          <>
            {profile?.role === 'cliente' ? (
              <>
                <Stack.Screen name="ClientHome" component={ClientTabs} options={{ headerShown: false }} />
                <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Tu Carrito', presentation: 'modal' }} />
              </>
            ) : profile?.role === 'trabajador' ? (
              <Stack.Screen name="WorkerHome" component={WorkerScreen} options={{ title: 'Panel Operativo' }} />
            ) : profile?.role === 'administrador' ? (
              <Stack.Screen name="AdminHome" component={AdminScreen} options={{ title: 'Administración' }} />
            ) : (
              <Stack.Screen name="Fallback" options={{ title: 'Cargando...' }}>
                {() => (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Cargando tu perfil o rol no asignado...</Text>
                    <Button title="Cerrar Sesión" onPress={() => supabase.auth.signOut()} />
                  </View>
                )}
              </Stack.Screen>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
