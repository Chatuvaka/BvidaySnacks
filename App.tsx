import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { requireOptionalNativeModule } from 'expo';

// Desactiva el menú de desarrollador al agitar el teléfono en Expo Go
const DevMenuPreferences = requireOptionalNativeModule('DevMenuPreferences');
DevMenuPreferences?.setPreferencesAsync({
  motionGestureEnabled: false,
});

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppNavigator />
      </CartProvider>
    </AuthProvider>
  );
}
