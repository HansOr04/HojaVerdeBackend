import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../server';
import { 
  loginSchema, 
  registerSchema, 
  changePasswordSchema 
} from '../validators/auth.validators';
import { z } from 'zod';

// Interface para el request con usuario
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'EDITOR' | 'VIEWER';
    employeeId?: string;
  };
}

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      // Validar input
      const { email, password } = loginSchema.parse(req.body);

      // Buscar usuario
      const user = await prisma.user.findUnique({
        where: { email },
        include: { employee: true }
      });

      if (!user || !user.isActive) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }

      // Verificar contraseña
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }

      // Generar token JWT
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET!,
        { expiresIn: '8h' }
      );

      // Responder con usuario y token
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          employee: user.employee ? {
            id: user.employee.id,
            firstName: user.employee.firstName,
            lastName: user.employee.lastName,
            identification: user.employee.identification
          } : null
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Error al iniciar sesión' });
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      // Validar input
      const { email, password, employeeId } = registerSchema.parse(req.body);

      // Verificar si el email ya existe
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        res.status(400).json({ error: 'El email ya está registrado' });
        return;
      }

      // Verificar si el empleado existe y no tiene usuario
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { user: true }
      });

      if (!employee) {
        res.status(404).json({ error: 'Empleado no encontrado' });
        return;
      }

      if (employee.user) {
        res.status(400).json({ error: 'El empleado ya tiene un usuario asignado' });
        return;
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear usuario
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          employeeId,
          role: 'VIEWER' // Por defecto es VIEWER
        },
        include: { employee: true }
      });

      res.status(201).json({
        message: 'Usuario creado exitosamente',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          employee: {
            firstName: user.employee.firstName,
            lastName: user.employee.lastName
          }
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      console.error('Error en registro:', error);
      res.status(500).json({ error: 'Error al registrar usuario' });
    }
  }

  async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { 
          employee: {
            include: { area: true }
          }
        }
      });

      if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        employee: user.employee ? {
          id: user.employee.id,
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          identification: user.employee.identification,
          position: user.employee.position,
          area: user.employee.area
        } : null
      });
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      res.status(500).json({ error: 'Error al obtener información del usuario' });
    }
  }

  async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const userId = req.user.id;

      // Obtener usuario actual
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      // Verificar contraseña actual
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        res.status(401).json({ error: 'Contraseña actual incorrecta' });
        return;
      }

      // Hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar contraseña
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      console.error('Error al cambiar contraseña:', error);
      res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
  }
}