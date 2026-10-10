import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ REEMPLAZA ESTOS VALORES CON LOS DE TU IMAGEN
const supabaseUrl = 'https://ddlzgwglqglnvvkyexav.supabase.co';
const supabaseAnonKey = 'sb_publishable_ILCHbHBexuV_Tj5SpT150A_KjCdysLD';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
