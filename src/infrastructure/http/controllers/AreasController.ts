import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../server';

// Validadores Zod (ajustados al esquema real)
const createAreaSchema = z.object({
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .transform(val => val.toUpperCase().trim()),
  defaultEntryTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:mm)'),
  defaultExitTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:mm)'),
  defaultLunchDuration: z.number()
    .int('Los minutos deben ser un número entero')
    .min(0, 'Los minutos no pueden ser negativos')
    .max(180, 'Los minutos no pueden exceder 3 horas')
    .optional()
    .default(30),
  defaultWorkingHours: z.number()
    .int('Las horas deben ser un número entero')
    .min(1, 'Debe tener al menos 1 hora de trabajo')
    .max(12, 'No puede exceder 12 horas de trabajo')
    .optional()
    .default(8)
});

const updateAreaSchema = createAreaSchema.partial();

const areasQuerySchema = z.object({
  includeEmployees: z.string()
    .optional()
    .transform(val => val === 'true'),
  search: z.string().optional()
});

// Helper para formatear hora de Date a string HH:mm
function formatTimeToString(date: Date): string {
  // Para campos @db.Time, Prisma devuelve un Date pero solo nos interesa HH:mm
  return date.toISOString().substr(11, 5);
}

// Helper para crear Date de tiempo para Prisma
function createTimeDate(timeString: string): Date {
  return new Date(`1970-01-01T${timeString}:00.000Z`);
}

export class AreasController {
  
  /**
   * GET /api/areas
   * Listar todas las áreas con filtros opcionales
   */
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const query = areasQuerySchema.parse(req.query);
      
      const areas = await prisma.area.findMany({
        where: {
          ...(query.search && {
            name: {
              contains: query.search.toUpperCase(),
              mode: 'insensitive'
            }
          })
        },
        include: {
          ...(query.includeEmployees && {
            employees: {
              where: { isActive: true },
              select: {
                id: true,
                identification: true,
                firstName: true,
                lastName: true,
                position: true,
                baseSalary: true,
                isActive: true,
                createdAt: true
              },
              orderBy: [
                { lastName: 'asc' },
                { firstName: 'asc' }
              ]
            }
          }),
          _count: {
            select: {
              employees: {
                where: { isActive: true }
              }
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      // Formatear respuesta
      const formattedAreas = areas.map(area => ({
        id: area.id,
        name: area.name,
        defaultEntryTime: formatTimeToString(area.defaultEntryTime),
        defaultExitTime: formatTimeToString(area.defaultExitTime),
        defaultLunchDuration: area.defaultLunchDuration,
        defaultWorkingHours: area.defaultWorkingHours,
        employeesCount: area._count.employees,
        ...(query.includeEmployees && {
          employees: area.employees?.map(emp => ({
            id: emp.id,
            identification: emp.identification,
            fullName: `${emp.firstName} ${emp.lastName}`,
            firstName: emp.firstName,
            lastName: emp.lastName,
            position: emp.position,
            baseSalary: emp.baseSalary,
            isActive: emp.isActive,
            createdAt: emp.createdAt
          }))
        }),
        createdAt: area.createdAt,
        updatedAt: area.updatedAt
      }));

      res.json({
        success: true,
        data: formattedAreas,
        meta: {
          total: formattedAreas.length,
          includeEmployees: query.includeEmployees
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Parámetros de consulta inválidos',
          errors: error.errors
        });
        return;
      }

      console.error('Error al obtener áreas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/areas/:id
   * Obtener área específica con empleados
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const area = await prisma.area.findUnique({
        where: { id },
        include: {
          employees: {
            where: { isActive: true },
            select: {
              id: true,
              identification: true,
              firstName: true,
              lastName: true,
              position: true,
              baseSalary: true,
              isActive: true,
              createdAt: true
            },
            orderBy: [
              { lastName: 'asc' },
              { firstName: 'asc' }
            ]
          },
          _count: {
            select: {
              employees: {
                where: { isActive: true }
              }
            }
          }
        }
      });

      if (!area) {
        res.status(404).json({
          success: false,
          message: 'Área no encontrada'
        });
        return;
      }

      // Formatear respuesta
      const formattedArea = {
        id: area.id,
        name: area.name,
        defaultEntryTime: formatTimeToString(area.defaultEntryTime),
        defaultExitTime: formatTimeToString(area.defaultExitTime),
        defaultLunchDuration: area.defaultLunchDuration,
        defaultWorkingHours: area.defaultWorkingHours,
        employeesCount: area._count.employees,
        employees: area.employees.map(emp => ({
          id: emp.id,
          identification: emp.identification,
          fullName: `${emp.firstName} ${emp.lastName}`,
          firstName: emp.firstName,
          lastName: emp.lastName,
          position: emp.position,
          baseSalary: emp.baseSalary,
          isActive: emp.isActive,
          createdAt: emp.createdAt
        })),
        createdAt: area.createdAt,
        updatedAt: area.updatedAt
      };

      res.json({
        success: true,
        data: formattedArea
      });

    } catch (error) {
      console.error('Error al obtener área:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/areas
   * Crear nueva área (solo ADMIN)
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createAreaSchema.parse(req.body);
      
      // Verificar que no exista un área con el mismo nombre
      const existingArea = await prisma.area.findFirst({
        where: {
          name: validatedData.name
        }
      });

      if (existingArea) {
        res.status(409).json({
          success: false,
          message: 'Ya existe un área con este nombre'
        });
        return;
      }

      // Validar que la hora de entrada sea menor a la de salida
      const entryTime = createTimeDate(validatedData.defaultEntryTime);
      const exitTime = createTimeDate(validatedData.defaultExitTime);
      
      if (entryTime >= exitTime) {
        res.status(400).json({
          success: false,
          message: 'La hora de entrada debe ser menor a la hora de salida'
        });
        return;
      }

      const area = await prisma.area.create({
        data: {
          name: validatedData.name,
          defaultEntryTime: entryTime,
          defaultExitTime: exitTime,
          defaultLunchDuration: validatedData.defaultLunchDuration,
          defaultWorkingHours: validatedData.defaultWorkingHours
        }
      });

      res.status(201).json({
        success: true,
        message: 'Área creada exitosamente',
        data: {
          id: area.id,
          name: area.name,
          defaultEntryTime: formatTimeToString(area.defaultEntryTime),
          defaultExitTime: formatTimeToString(area.defaultExitTime),
          defaultLunchDuration: area.defaultLunchDuration,
          defaultWorkingHours: area.defaultWorkingHours,
          createdAt: area.createdAt,
          updatedAt: area.updatedAt
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: error.errors
        });
        return;
      }

      console.error('Error al crear área:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * PUT /api/areas/:id
   * Actualizar área (solo ADMIN)
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateAreaSchema.parse(req.body);

      // Verificar que el área existe
      const existingArea = await prisma.area.findUnique({
        where: { id }
      });

      if (!existingArea) {
        res.status(404).json({
          success: false,
          message: 'Área no encontrada'
        });
        return;
      }

      // Si se está actualizando el nombre, verificar que no exista otra área con ese nombre
      if (validatedData.name && validatedData.name !== existingArea.name) {
        const duplicateArea = await prisma.area.findFirst({
          where: {
            name: validatedData.name,
            id: { not: id }
          }
        });

        if (duplicateArea) {
          res.status(409).json({
            success: false,
            message: 'Ya existe un área con este nombre'
          });
          return;
        }
      }

      // Preparar datos de actualización
      const updateData: any = {
        updatedAt: new Date()
      };

      if (validatedData.name) updateData.name = validatedData.name;
      if (validatedData.defaultLunchDuration !== undefined) {
        updateData.defaultLunchDuration = validatedData.defaultLunchDuration;
      }
      if (validatedData.defaultWorkingHours !== undefined) {
        updateData.defaultWorkingHours = validatedData.defaultWorkingHours;
      }

      // Validar y actualizar horarios si se están modificando
      if (validatedData.defaultEntryTime || validatedData.defaultExitTime) {
        const entryTimeStr = validatedData.defaultEntryTime || formatTimeToString(existingArea.defaultEntryTime);
        const exitTimeStr = validatedData.defaultExitTime || formatTimeToString(existingArea.defaultExitTime);
        
        const entryTime = createTimeDate(entryTimeStr);
        const exitTime = createTimeDate(exitTimeStr);
        
        if (entryTime >= exitTime) {
          res.status(400).json({
            success: false,
            message: 'La hora de entrada debe ser menor a la hora de salida'
          });
          return;
        }

        if (validatedData.defaultEntryTime) updateData.defaultEntryTime = entryTime;
        if (validatedData.defaultExitTime) updateData.defaultExitTime = exitTime;
      }

      const updatedArea = await prisma.area.update({
        where: { id },
        data: updateData
      });

      res.json({
        success: true,
        message: 'Área actualizada exitosamente',
        data: {
          id: updatedArea.id,
          name: updatedArea.name,
          defaultEntryTime: formatTimeToString(updatedArea.defaultEntryTime),
          defaultExitTime: formatTimeToString(updatedArea.defaultExitTime),
          defaultLunchDuration: updatedArea.defaultLunchDuration,
          defaultWorkingHours: updatedArea.defaultWorkingHours,
          createdAt: updatedArea.createdAt,
          updatedAt: updatedArea.updatedAt
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: error.errors
        });
        return;
      }

      console.error('Error al actualizar área:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * DELETE /api/areas/:id
   * Eliminar área sin empleados (solo ADMIN)
   * Nota: Eliminación permanente ya que no hay campo isActive
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Verificar que el área existe
      const area = await prisma.area.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              employees: {
                where: { isActive: true }
              }
            }
          }
        }
      });

      if (!area) {
        res.status(404).json({
          success: false,
          message: 'Área no encontrada'
        });
        return;
      }

      // Verificar que no tenga empleados activos
      if (area._count.employees > 0) {
        res.status(409).json({
          success: false,
          message: `No se puede eliminar el área porque tiene ${area._count.employees} empleado(s) activo(s)`
        });
        return;
      }

      // Eliminar área (hard delete ya que no hay isActive)
      await prisma.area.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Área eliminada exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar área:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}