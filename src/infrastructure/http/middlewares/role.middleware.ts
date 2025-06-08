import { Request, Response, NextFunction } from 'express';

// Interface para request con usuario
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'EDITOR' | 'VIEWER';
    employeeId?: string;
  };
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!roles.includes(authReq.user.role)) {
      res.status(403).json({ 
        error: 'No tienes permisos para realizar esta acción',
        requiredRoles: roles,
        userRole: authReq.user.role
      });
      return;
    }

    next();
  };
}

// Middleware helpers
export const requireAdmin = requireRole(['ADMIN']);
export const requireEditor = requireRole(['ADMIN', 'EDITOR']);
export const requireViewer = requireRole(['ADMIN', 'EDITOR', 'VIEWER']);
