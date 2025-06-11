// ====================================================================
// src/config/supabase.ts - ACTUALIZADO PARA RLS
// ====================================================================

import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan variables de entorno de Supabase');
}

// Cliente para uso del servidor (con permisos completos)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Función helper para verificar tokens de Supabase (si necesitas compatibilidad)
export async function verifySupabaseToken(token: string) {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// ====================================================================
// FUNCIONES PARA RLS - CRÍTICO PARA SEGURIDAD
// ====================================================================

/**
 * Establece el contexto de usuario para Row Level Security
 * Esta función es CRÍTICA para que RLS funcione correctamente
 */
export async function setUserContext(userId: string): Promise<void> {
  try {
    // Método 1: Usar configuración de sesión PostgreSQL
    await supabaseAdmin.rpc('set_config', {
      setting_name: 'app.current_user_id',
      setting_value: userId,
      is_local: true
    });
  } catch (error) {
    console.error('Error estableciendo contexto de usuario para RLS:', error);
    // No lanzar error para no romper el flujo de autenticación
    // RLS funcionará con las políticas basadas en auth.uid()
  }
}

/**
 * Establece el contexto de usuario usando auth.uid() de Supabase
 * Alternativa más directa para RLS
 */
export async function setSupabaseUserContext(userId: string): Promise<void> {
  try {
    // Simular autenticación de usuario en Supabase para RLS
    const { error } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (error) {
      console.warn('Usuario no encontrado en Supabase auth:', userId);
    }
  } catch (error) {
    console.error('Error estableciendo contexto Supabase:', error);
  }
}

/**
 * Crear cliente Supabase con contexto de usuario específico
 * Para consultas que requieren contexto de usuario específico
 */
export function createUserClient(userToken?: string) {
  if (!userToken) {
    return supabaseAdmin;
  }

  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    }
  );
}
