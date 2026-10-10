import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../supabase';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants, { AppOwnership } from 'expo-constants';

// Expo Go ya no soporta notificaciones push nativas desde el SDK 53.
// Solo registramos el handler si estamos en una build real (APK o IPA).
if (Constants.appOwnership !== AppOwnership.Expo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'cliente' | 'trabajador' | 'administrador';
};

type AuthContextType = {
  session: any | null;
  profile: Profile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ session: null, profile: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const registerForPushNotificationsAsync = async (userId: string) => {
    // Si estamos en Expo Go, abortamos porque crashearía.
    if (Constants.appOwnership === AppOwnership.Expo) {
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return;
      }
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || '3f214898-5837-4740-b346-fcf83ca7c78f';
        const pushTokenString = (await Notifications.getExpoPushTokenAsync({
          projectId,
        })).data;
        
        await supabase.from('profiles').update({ push_token: pushTokenString }).eq('id', userId);
      } catch (e) {
        console.log('Error getting push token', e);
      }
    }
  };

  const fetchProfile = async (userId: string) => {
    // Registramos el token push en segundo plano
    registerForPushNotificationsAsync(userId);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) setProfile(data as Profile);
    if (error) console.error('Error fetching profile:', error);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
