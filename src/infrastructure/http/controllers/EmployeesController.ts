import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../server';

// Validadores Zod
const createEmployeeSchema = z.object({
  identification: z.string()
    .min(8, 'La identificación debe tener al menos 8 caracteres')
    .max(20, 'La identificación no puede exceder 20 caracteres')
    .regex(/^[0-9]+$/, 'La identificación solo puede contener números'),
  firstName: z.string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .transform(val => val.toUpperCase().trim()),
  lastName: z.string()
    .min(1, 'El apellido es requerido')
    .max(100, 'El apellido no puede exceder 100 caracteres')
    .transform(val => val.toUpperCase().trim()),
  areaId: z.string()
    .uuid('ID de área inválido')
    .optional(),
  position: z.string()
    .max(100, 'El cargo no puede exceder 100 caracteres')
    .optional(),
  baseSalary: z.number()
    .positive('El salario debe ser positivo')
    .max(10000, 'El salario no puede exceder $10,000')
    .optional()
});

const updateEmployeeSchema = createEmployeeSchema.partial();

const employeesQuerySchema = z.object({
  areaIds: z.string()
    .optional()
    .transform(val => val ? val.split(',').map(id => id.trim()) : undefined),
  areaId: z.string()
    .uuid('ID de área inválido')
    .optional(),
  activeOnly: z.string()
    .optional()
    .transform(val => val === 'true')
    .default('true'),
  search: z.string().optional(),
  page: z.string()
    .optional()
    .transform(val => val ? parseInt(val) : 1)
    .default('1'),
  limit: z.string()
    .optional()
    .transform(val => val ? Math.min(parseInt(val), 500) : 50) // Máximo 500 para registro masivo
    .default('50')
});

const multipleAreasSchema = z.object({
  areaIds: z.array(z.string().uuid('ID de área inválido'))
    .min(1, 'Debe especificar al menos un área')
    .max(10, 'No puede especificar más de 10 áreas a la vez')
});

export class EmployeesController {

  /**
   * GET /api/employees
   * Listar empleados con filtros y paginación
   */
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const query = employeesQuerySchema.parse(req.query);
      
      // Construir filtros
      const where: any = {};
      
      if (query.activeOnly) {
        where.isActive = true;
      }
      
      if (query.areaId) {
        where.areaId = query.areaId;
      }
      
      if (query.areaIds && query.areaIds.length > 0) {
        where.areaId = { in: query.areaIds };
      }
      
      if (query.search) {
        where.OR = [
          { identification: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search.toUpperCase(), mode: 'insensitive' } },
          { lastName: { contains: query.search.toUpperCase(), mode: 'insensitive' } }
        ];
      }

      // Paginación
      const skip = (query.page - 1) * query.limit;

      // Obtener total para paginación
      const total = await prisma.employee.count({ where });

      // Obtener empleados
      const employees = await prisma.employee.findMany({
        where,
        include: {
          area: {
            select: {
              id: true,
              name: true,
              defaultEntryTime: true,
              defaultExitTime: true,
              defaultLunchDuration: true,
              defaultWorkingHours: true
            }
          }
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' }
        ],
        skip,
        take: query.limit
      });

      // Formatear respuesta
      const formattedEmployees = employees.map(emp => ({
        id: emp.id,
        identification: emp.identification,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: `${emp.firstName} ${emp.lastName}`,
        areaId: emp.areaId,
        area: emp.area ? {
          id: emp.area.id,
          name: emp.area.name,
          defaultEntryTime: emp.area.defaultEntryTime.toISOString().substr(11, 5),
          defaultExitTime: emp.area.defaultExitTime.toISOString().substr(11, 5),
          defaultLunchDuration: emp.area.defaultLunchDuration,
          defaultWorkingHours: emp.area.defaultWorkingHours
        } : null,
        position: emp.position,
        baseSalary: emp.baseSalary,
        isActive: emp.isActive,
        createdAt: emp.createdAt,
        updatedAt: emp.updatedAt
      }));

      res.json({
        success: true,
        data: formattedEmployees,
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
          hasNextPage: query.page * query.limit < total,
          hasPrevPage: query.page > 1
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

      console.error('Error al obtener empleados:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/employees/by-areas
   * CRÍTICO PARA MARÍA: Obtener empleados de múltiples áreas para registro masivo
   */
  static async getByMultipleAreas(req: Request, res: Response): Promise<void> {
    try {
      // Validar que se proporcionen IDs de áreas
      const areaIdsParam = req.query.areaIds as string;
      if (!areaIdsParam) {
        res.status(400).json({
          success: false,
          message: 'Debe especificar los IDs de áreas en el parámetro areaIds'
        });
        return;
      }

      const areaIds = areaIdsParam.split(',').map(id => id.trim());
      const { areaIds: validatedAreaIds } = multipleAreasSchema.parse({ areaIds });

      // Verificar que todas las áreas existen
      const existingAreas = await prisma.area.findMany({
        where: { id: { in: validatedAreaIds } },
        select: {
          id: true,
          name: true,
          defaultEntryTime: true,
          defaultExitTime: true,
          defaultLunchDuration: true,
          defaultWorkingHours: true
        }
      });

      if (existingAreas.length !== validatedAreaIds.length) {
        const foundIds = existingAreas.map(area => area.id);
        const notFoundIds = validatedAreaIds.filter(id => !foundIds.includes(id));
        
        res.status(404).json({
          success: false,
          message: `Áreas no encontradas: ${notFoundIds.join(', ')}`
        });
        return;
      }

      // Obtener empleados activos de todas las áreas especificadas
      const employees = await prisma.employee.findMany({
        where: {
          areaId: { in: validatedAreaIds },
          isActive: true
        },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              defaultEntryTime: true,
              defaultExitTime: true,
              defaultLunchDuration: true,
              defaultWorkingHours: true
            }
          }
        },
        orderBy: [
          { areaId: 'asc' }, // Agrupar por área
          { lastName: 'asc' },
          { firstName: 'asc' }
        ]
      });

      // Formatear respuesta agrupada por área
      const employeesByArea = existingAreas.map(area => ({
        area: {
          id: area.id,
          name: area.name,
          defaultEntryTime: area.defaultEntryTime.toISOString().substr(11, 5),
          defaultExitTime: area.defaultExitTime.toISOString().substr(11, 5),
          defaultLunchDuration: area.defaultLunchDuration,
          defaultWorkingHours: area.defaultWorkingHours
        },
        employees: employees
          .filter(emp => emp.areaId === area.id)
          .map(emp => ({
            id: emp.id,
            identification: emp.identification,
            firstName: emp.firstName,
            lastName: emp.lastName,
            fullName: `${emp.firstName} ${emp.lastName}`,
            position: emp.position,
            baseSalary: emp.baseSalary,
            // Valores por defecto para registro de asistencia
            defaultValues: {
              entryTime: area.defaultEntryTime.toISOString().substr(11, 5),
              exitTime: area.defaultExitTime.toISOString().substr(11, 5),
              lunchDuration: area.defaultLunchDuration,
              isVacation: false,
              // Valores por defecto de alimentación
              foodAllowance: {
                breakfast: 1,
                reinforcedBreakfast: 0,
                snack1: 1,
                afternoonSnack: 0,
                dryMeal: 0,
                lunch: 1,
                transport: 0
              }
            }
          })),
        employeesCount: employees.filter(emp => emp.areaId === area.id).length
      }));

      const totalEmployees = employees.length;

      res.json({
        success: true,
        data: employeesByArea,
        meta: {
          totalAreas: existingAreas.length,
          totalEmployees,
          requestedAreas: validatedAreaIds,
          message: `Datos listos para registro masivo de ${totalEmployees} empleados en ${existingAreas.length} área(s)`
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'IDs de áreas inválidos',
          errors: error.errors
        });
        return;
      }

      console.error('Error al obtener empleados por múltiples áreas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/employees/:id
   * Obtener empleado específico
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              defaultEntryTime: true,
              defaultExitTime: true,
              defaultLunchDuration: true,
              defaultWorkingHours: true
            }
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true
            }
          }
        }
      });

      if (!employee) {
        res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
        return;
      }

      const formattedEmployee = {
        id: employee.id,
        identification: employee.identification,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`,
        areaId: employee.areaId,
        area: employee.area ? {
          id: employee.area.id,
          name: employee.area.name,
          defaultEntryTime: employee.area.defaultEntryTime.toISOString().substr(11, 5),
          defaultExitTime: employee.area.defaultExitTime.toISOString().substr(11, 5),
          defaultLunchDuration: employee.area.defaultLunchDuration,
          defaultWorkingHours: employee.area.defaultWorkingHours
        } : null,
        position: employee.position,
        baseSalary: employee.baseSalary,
        isActive: employee.isActive,
        user: employee.user,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt
      };

      res.json({
        success: true,
        data: formattedEmployee
      });

    } catch (error) {
      console.error('Error al obtener empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/employees
   * Crear nuevo empleado (ADMIN/EDITOR)
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createEmployeeSchema.parse(req.body);

      // Verificar que no exista empleado con la misma identificación
      const existingEmployee = await prisma.employee.findUnique({
        where: { identification: validatedData.identification }
      });

      if (existingEmployee) {
        res.status(409).json({
          success: false,
          message: 'Ya existe un empleado con esta identificación'
        });
        return;
      }

      // Verificar que el área existe si se proporciona
      if (validatedData.areaId) {
        const area = await prisma.area.findUnique({
          where: { id: validatedData.areaId }
        });

        if (!area) {
          res.status(404).json({
            success: false,
            message: 'Área no encontrada'
          });
          return;
        }
      }

      const employee = await prisma.employee.create({
        data: validatedData,
        include: {
          area: {
            select: {
              id: true,
              name: true,
              defaultEntryTime: true,
              defaultExitTime: true,
              defaultLunchDuration: true,
              defaultWorkingHours: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Empleado creado exitosamente',
        data: {
          id: employee.id,
          identification: employee.identification,
          firstName: employee.firstName,
          lastName: employee.lastName,
          fullName: `${employee.firstName} ${employee.lastName}`,
          areaId: employee.areaId,
          area: employee.area ? {
            id: employee.area.id,
            name: employee.area.name,
            defaultEntryTime: employee.area.defaultEntryTime.toISOString().substr(11, 5),
            defaultExitTime: employee.area.defaultExitTime.toISOString().substr(11, 5),
            defaultLunchDuration: employee.area.defaultLunchDuration,
            defaultWorkingHours: employee.area.defaultWorkingHours
          } : null,
          position: employee.position,
          baseSalary: employee.baseSalary,
          isActive: employee.isActive,
          createdAt: employee.createdAt,
          updatedAt: employee.updatedAt
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

      console.error('Error al crear empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * PUT /api/employees/:id
   * Actualizar empleado (ADMIN/EDITOR)
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateEmployeeSchema.parse(req.body);

      // Verificar que el empleado existe
      const existingEmployee = await prisma.employee.findUnique({
        where: { id }
      });

      if (!existingEmployee) {
        res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
        return;
      }

      // Verificar identificación única si se está actualizando
      if (validatedData.identification && validatedData.identification !== existingEmployee.identification) {
        const duplicateEmployee = await prisma.employee.findUnique({
          where: { identification: validatedData.identification }
        });

        if (duplicateEmployee) {
          res.status(409).json({
            success: false,
            message: 'Ya existe un empleado con esta identificación'
          });
          return;
        }
      }

      // Verificar área si se está actualizando
      if (validatedData.areaId) {
        const area = await prisma.area.findUnique({
          where: { id: validatedData.areaId }
        });

        if (!area) {
          res.status(404).json({
            success: false,
            message: 'Área no encontrada'
          });
          return;
        }
      }

      const updatedEmployee = await prisma.employee.update({
        where: { id },
        data: {
          ...validatedData,
          updatedAt: new Date()
        },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              defaultEntryTime: true,
              defaultExitTime: true,
              defaultLunchDuration: true,
              defaultWorkingHours: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Empleado actualizado exitosamente',
        data: {
          id: updatedEmployee.id,
          identification: updatedEmployee.identification,
          firstName: updatedEmployee.firstName,
          lastName: updatedEmployee.lastName,
          fullName: `${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
          areaId: updatedEmployee.areaId,
          area: updatedEmployee.area ? {
            id: updatedEmployee.area.id,
            name: updatedEmployee.area.name,
            defaultEntryTime: updatedEmployee.area.defaultEntryTime.toISOString().substr(11, 5),
            defaultExitTime: updatedEmployee.area.defaultExitTime.toISOString().substr(11, 5),
            defaultLunchDuration: updatedEmployee.area.defaultLunchDuration,
            defaultWorkingHours: updatedEmployee.area.defaultWorkingHours
          } : null,
          position: updatedEmployee.position,
          baseSalary: updatedEmployee.baseSalary,
          isActive: updatedEmployee.isActive,
          createdAt: updatedEmployee.createdAt,
          updatedAt: updatedEmployee.updatedAt
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

      console.error('Error al actualizar empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * DELETE /api/employees/:id
   * Desactivar empleado (soft delete) - Solo ADMIN
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!employee) {
        res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
        return;
      }

      // Soft delete del empleado
      await prisma.employee.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      // Si tiene usuario asociado, también desactivarlo
      if (employee.user) {
        await prisma.user.update({
          where: { employeeId: id },
          data: {
            isActive: false,
            updatedAt: new Date()
          }
        });
      }

      res.json({
        success: true,
        message: 'Empleado desactivado exitosamente'
      });

    } catch (error) {
      console.error('Error al desactivar empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/employees/:id/activate
   * Reactivar empleado desactivado - Solo ADMIN
   */
  static async activate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!employee) {
        res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
        return;
      }

      if (employee.isActive) {
        res.status(400).json({
          success: false,
          message: 'El empleado ya está activo'
        });
        return;
      }

      // Reactivar empleado
      const reactivatedEmployee = await prisma.employee.update({
        where: { id },
        data: {
          isActive: true,
          updatedAt: new Date()
        },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              defaultEntryTime: true,
              defaultExitTime: true,
              defaultLunchDuration: true,
              defaultWorkingHours: true
            }
          }
        }
      });

      // Si tiene usuario asociado, también reactivarlo
      if (employee.user) {
        await prisma.user.update({
          where: { employeeId: id },
          data: {
            isActive: true,
            updatedAt: new Date()
          }
        });
      }

      res.json({
        success: true,
        message: 'Empleado reactivado exitosamente',
        data: {
          id: reactivatedEmployee.id,
          identification: reactivatedEmployee.identification,
          firstName: reactivatedEmployee.firstName,
          lastName: reactivatedEmployee.lastName,
          fullName: `${reactivatedEmployee.firstName} ${reactivatedEmployee.lastName}`,
          areaId: reactivatedEmployee.areaId,
          area: reactivatedEmployee.area ? {
            id: reactivatedEmployee.area.id,
            name: reactivatedEmployee.area.name,
            defaultEntryTime: reactivatedEmployee.area.defaultEntryTime.toISOString().substr(11, 5),
            defaultExitTime: reactivatedEmployee.area.defaultExitTime.toISOString().substr(11, 5),
            defaultLunchDuration: reactivatedEmployee.area.defaultLunchDuration,
            defaultWorkingHours: reactivatedEmployee.area.defaultWorkingHours
          } : null,
          position: reactivatedEmployee.position,
          baseSalary: reactivatedEmployee.baseSalary,
          isActive: reactivatedEmployee.isActive,
          createdAt: reactivatedEmployee.createdAt,
          updatedAt: reactivatedEmployee.updatedAt
        }
      });

    } catch (error) {
      console.error('Error al reactivar empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}