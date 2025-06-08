import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../server';

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
      res.status(401).json({ error: 'Token no proporcionado' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Buscar usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { employee: true }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Usuario no autorizado' });
      return;
    }

    // Agregar usuario al request (usando type assertion)
    (req as AuthRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role as 'ADMIN' | 'EDITOR' | 'VIEWER',
      employeeId: user.employeeId
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    res.status(500).json({ error: 'Error de autenticación' });
    return;
  }
}
