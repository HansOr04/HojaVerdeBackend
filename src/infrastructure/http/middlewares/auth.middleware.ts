import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../server';
import { setUserContext } from '../../../config/supabase';

// Extender Request con la propiedad user
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'EDITOR' | 'VIEWER';
    employeeId?: string;
  };
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        success: false,
        error: 'Token no proporcionado',
        message: 'Se requiere autenticación para acceder a este recurso'
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Buscar usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { 
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            identification: true,
            position: true,
            areaId: true,
            area: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ 
        success: false,
        error: 'Usuario no autorizado',
        message: 'Usuario inactivo o no encontrado'
      });
      return;
    }

    // ========================================
    // 🔒 CRÍTICO: Establecer contexto para RLS
    // ========================================
    try {
      await setUserContext(user.id);
    } catch (contextError) {
      console.warn('No se pudo establecer contexto RLS:', contextError);
      // Continuar sin romper el flujo - RLS usará políticas alternativas
    }

    // Agregar usuario al request con información completa
    (req as AuthRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role as 'ADMIN' | 'EDITOR' | 'VIEWER',
      employeeId: user.employeeId
    };

    // Log de auditoría para operaciones críticas (opcional)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 Auth: ${user.email} (${user.role}) - ${req.method} ${req.path}`);
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false,
        error: 'Token inválido',
        message: 'El token de autenticación es inválido o ha expirado'
      });
      return;
    }

    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error de autenticación',
      message: 'Error interno del servidor durante la autenticación'
    });
    return;
  }
}

// ====================================================================
// MIDDLEWARE ALTERNATIVO PARA OPERACIONES CRÍTICAS
// Para endpoints que requieren contexto RLS específico
// ====================================================================

export async function authMiddlewareWithRLS(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Ejecutar autenticación normal
    await new Promise<void>((resolve, reject) => {
      authMiddleware(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      res.status(401).json({ 
        success: false,
        error: 'Usuario no autenticado',
        message: 'Contexto de usuario requerido para esta operación'
      });
      return;
    }

    // Establecer contexto RLS adicional si es necesario
    try {
      await setUserContext(authReq.user.id);
      
      // Log específico para operaciones RLS críticas
      console.log(`🔒 RLS Context set for user: ${authReq.user.email} (${authReq.user.role})`);
    } catch (rlsError) {
      console.error('Error crítico estableciendo contexto RLS:', rlsError);
      
      // Para operaciones críticas, fallar si no se puede establecer contexto
      res.status(500).json({
        success: false,
        error: 'Error de seguridad',
        message: 'No se pudo establecer contexto de seguridad requerido'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error en middleware RLS:', error);
    res.status(500).json({
      success: false,
      error: 'Error de autenticación con RLS',
      message: 'Error interno del servidor'
    });
  }
}

// ====================================================================
// FUNCIONES HELPER PARA CONTROLADORES
// ====================================================================

/**
 * Obtener información del usuario actual desde el request
 */
export function getCurrentUser(req: Request) {
  const authReq = req as AuthRequest;
  return authReq.user;
}

/**
 * Verificar si el usuario actual tiene un rol específico
 */
export function hasRole(req: Request, roles: string[]): boolean {
  const user = getCurrentUser(req);
  return user ? roles.includes(user.role) : false;
}

/**
 * Verificar si el usuario actual es ADMIN
 */
export function isAdmin(req: Request): boolean {
  return hasRole(req, ['ADMIN']);
}

/**
 * Verificar si el usuario actual puede editar (ADMIN o EDITOR)
 */
export function canEdit(req: Request): boolean {
  return hasRole(req, ['ADMIN', 'EDITOR']);
}

/**
 * Verificar si el usuario puede ver (cualquier rol autenticado)
 */
export function canView(req: Request): boolean {
  return hasRole(req, ['ADMIN', 'EDITOR', 'VIEWER']);
}

