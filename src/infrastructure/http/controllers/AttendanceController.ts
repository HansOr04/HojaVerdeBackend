import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../server';
import { Decimal } from '@prisma/client/runtime/library';

// Validadores Zod
const foodAllowanceSchema = z.object({
  breakfast: z.number().int().min(0).max(5).default(0),
  reinforcedBreakfast: z.number().int().min(0).max(5).default(0),
  snack1: z.number().int().min(0).max(5).default(0),
  afternoonSnack: z.number().int().min(0).max(5).default(0),
  dryMeal: z.number().int().min(0).max(5).default(0),
  lunch: z.number().int().min(0).max(5).default(0),
  transport: z.number().min(0).max(50).default(0)
});

const attendanceRecordSchema = z.object({
  employeeId: z.string().uuid('ID de empleado inválido'),
  entryTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:mm)')
    .optional(),
  exitTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:mm)')
    .optional(),
  lunchDuration: z.number().int().min(0).max(180).optional().default(30),
  isVacation: z.boolean().default(false),
  permissionHours: z.number().min(0).max(12).optional().default(0),
  permissionReason: z.string().max(500).optional(),
  foodAllowance: foodAllowanceSchema.optional().default({}),
  // Campos calculados automáticamente
  workedHours: z.number().optional(),
  nightHours: z.number().optional().default(0),
  supplementaryHours: z.number().optional().default(0),
  extraordinaryHours: z.number().optional().default(0)
});

const bulkAttendanceSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  registeredBy: z.string().uuid('ID de usuario inválido').optional(),
  records: z.array(attendanceRecordSchema)
    .min(1, 'Debe incluir al menos un registro')
    .max(1000, 'No puede procesar más de 1000 registros a la vez') // Límite de seguridad
});

const templateQuerySchema = z.object({
  areaIds: z.string()
    .transform(val => val.split(',').map(id => id.trim()))
    .pipe(z.array(z.string().uuid()).min(1).max(10)),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
});

const verifyQuerySchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  areaIds: z.string()
    .optional()
    .transform(val => val ? val.split(',').map(id => id.trim()) : undefined)
});

// Helper functions
function createTimeDate(timeString: string): Date {
  return new Date(`1970-01-01T${timeString}:00.000Z`);
}

function formatTimeToString(date: Date): string {
  return date.toISOString().substr(11, 5);
}

function calculateWorkedHours(entryTime: string, exitTime: string, lunchDuration: number, permissionHours: number = 0): number {
  const entry = new Date(`1970-01-01T${entryTime}:00`);
  const exit = new Date(`1970-01-01T${exitTime}:00`);
  
  let diffMs = exit.getTime() - entry.getTime();
  
  // Si la salida es antes que la entrada, asumimos que cruzó medianoche
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000; // Añadir 24 horas
  }
  
  const totalHours = diffMs / (1000 * 60 * 60);
  const lunchHours = lunchDuration / 60;
  
  return Math.max(0, totalHours - lunchHours - permissionHours);
}

function calculateExtraHours(workedHours: number, defaultWorkingHours: number) {
  const baseHours = defaultWorkingHours || 8;
  
  if (workedHours <= baseHours) {
    return { nightHours: 0, supplementaryHours: 0, extraordinaryHours: 0 };
  }
  
  const extraHours = workedHours - baseHours;
  
  // Lógica simplificada para tipos de horas extras
  // En un sistema real, esto dependería de horarios específicos y políticas de la empresa
  if (extraHours <= 2) {
    return { 
      nightHours: 0, 
      supplementaryHours: extraHours, 
      extraordinaryHours: 0 
    };
  } else {
    return { 
      nightHours: 0, 
      supplementaryHours: 2, 
      extraordinaryHours: extraHours - 2 
    };
  }
}

export class AttendanceController {

  /**
   * GET /api/attendance/template
   * Obtener plantilla de registro para múltiples áreas con valores por defecto
   * CRÍTICO PARA MARÍA: Genera la plantilla base para 615 empleados
   */
  static async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { areaIds, date } = templateQuerySchema.parse(req.query);
      
      // Verificar que todas las áreas existen
      const areas = await prisma.area.findMany({
        where: { id: { in: areaIds } },
        include: {
          employees: {
            where: { isActive: true },
            select: {
              id: true,
              identification: true,
              firstName: true,
              lastName: true,
              position: true,
              baseSalary: true
            },
            orderBy: [
              { lastName: 'asc' },
              { firstName: 'asc' }
            ]
          }
        },
        orderBy: { name: 'asc' }
      });

      if (areas.length !== areaIds.length) {
        const foundIds = areas.map(area => area.id);
        const notFoundIds = areaIds.filter(id => !foundIds.includes(id));
        
        res.status(404).json({
          success: false,
          message: `Áreas no encontradas: ${notFoundIds.join(', ')}`
        });
        return;
      }

      // Verificar qué empleados ya tienen registro para esta fecha
      const existingRecords = await prisma.attendanceRecord.findMany({
        where: {
          date: new Date(date),
          employee: {
            areaId: { in: areaIds }
          }
        },
        select: { employeeId: true }
      });

      const employeesWithRecords = new Set(existingRecords.map(record => record.employeeId));

      // Generar plantilla con valores por defecto
      const template = {
        date,
        areas: areas.map(area => ({
          areaId: area.id,
          areaName: area.name,
          defaultEntryTime: formatTimeToString(area.defaultEntryTime),
          defaultExitTime: formatTimeToString(area.defaultExitTime),
          defaultLunchDuration: area.defaultLunchDuration,
          defaultWorkingHours: area.defaultWorkingHours,
          employees: area.employees.map(emp => ({
            employeeId: emp.id,
            identification: emp.identification,
            fullName: `${emp.firstName} ${emp.lastName}`,
            firstName: emp.firstName,
            lastName: emp.lastName,
            position: emp.position,
            baseSalary: emp.baseSalary,
            hasExistingRecord: employeesWithRecords.has(emp.id),
            // Valores por defecto pre-cargados
            defaultValues: {
              entryTime: formatTimeToString(area.defaultEntryTime),
              exitTime: formatTimeToString(area.defaultExitTime),
              lunchDuration: area.defaultLunchDuration,
              isVacation: false,
              permissionHours: 0,
              permissionReason: '',
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
          employeesCount: area.employees.length,
          employeesWithRecords: area.employees.filter(emp => employeesWithRecords.has(emp.id)).length
        }))
      };

      const totalEmployees = areas.reduce((sum, area) => sum + area.employees.length, 0);
      const totalWithRecords = existingRecords.length;

      res.json({
        success: true,
        data: template,
        meta: {
          totalAreas: areas.length,
          totalEmployees,
          employeesWithExistingRecords: totalWithRecords,
          employeesPendingRegistration: totalEmployees - totalWithRecords,
          date,
          message: `Plantilla lista para registrar ${totalEmployees - totalWithRecords} empleados sin registro en ${areas.length} área(s)`
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Parámetros inválidos',
          errors: error.errors
        });
        return;
      }

      console.error('Error al generar plantilla:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/attendance/bulk
   * Guardado masivo de registros de asistencia
   * CRÍTICO PARA MARÍA: Guarda 615 registros en una sola transacción
   */
  static async bulkCreate(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { date, records } = bulkAttendanceSchema.parse(req.body);
      const dateObj = new Date(date);

      // Validar que todos los empleados existen
      const employeeIds = records.map(record => record.employeeId);
      const employees = await prisma.employee.findMany({
        where: { 
          id: { in: employeeIds },
          isActive: true 
        },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              defaultWorkingHours: true
            }
          }
        }
      });

      if (employees.length !== employeeIds.length) {
        const foundIds = employees.map(emp => emp.id);
        const notFoundIds = employeeIds.filter(id => !foundIds.includes(id));
        
        res.status(404).json({
          success: false,
          message: `Empleados no encontrados o inactivos: ${notFoundIds.slice(0, 5).join(', ')}${notFoundIds.length > 5 ? ` y ${notFoundIds.length - 5} más` : ''}`
        });
        return;
      }

      // Crear mapa de empleados para lookup rápido
      const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

      // Procesar registros en transacción
      const result = await prisma.$transaction(async (tx) => {
        const processedRecords = [];
        const errors = [];

        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          const employee = employeeMap.get(record.employeeId);
          
          if (!employee) {
            errors.push({
              index: i,
              employeeId: record.employeeId,
              error: 'Empleado no encontrado'
            });
            continue;
          }

          try {
            // Verificar si ya existe registro para esta fecha
            const existingRecord = await tx.attendanceRecord.findUnique({
              where: {
                employeeId_date: {
                  employeeId: record.employeeId,
                  date: dateObj
                }
              }
            });

            if (existingRecord) {
              errors.push({
                index: i,
                employeeId: record.employeeId,
                identification: employee.identification,
                name: `${employee.firstName} ${employee.lastName}`,
                error: 'Ya existe registro para esta fecha'
              });
              continue;
            }

            // Calcular horas trabajadas si no es vacación
            let workedHours = 0;
            let nightHours = 0;
            let supplementaryHours = 0;
            let extraordinaryHours = 0;

            if (!record.isVacation && record.entryTime && record.exitTime) {
              workedHours = calculateWorkedHours(
                record.entryTime, 
                record.exitTime, 
                record.lunchDuration || 30,
                record.permissionHours || 0
              );

              const extraHours = calculateExtraHours(workedHours, employee.area?.defaultWorkingHours || 8);
              nightHours = extraHours.nightHours;
              supplementaryHours = extraHours.supplementaryHours;
              extraordinaryHours = extraHours.extraordinaryHours;
            }

            // Crear registro de asistencia
            const attendanceRecord = await tx.attendanceRecord.create({
              data: {
                employeeId: record.employeeId,
                date: dateObj,
                entryTime: record.entryTime ? createTimeDate(record.entryTime) : null,
                exitTime: record.exitTime ? createTimeDate(record.exitTime) : null,
                lunchDuration: record.lunchDuration || 30,
                workedHours: new Decimal(workedHours.toFixed(2)),
                isVacation: record.isVacation || false,
                permissionHours: record.permissionHours ? new Decimal(record.permissionHours.toFixed(2)) : new Decimal(0),
                permissionReason: record.permissionReason || null
              }
            });

            // Crear registro de alimentación
            const foodAllowance = { ...{ breakfast: 0, reinforcedBreakfast: 0, snack1: 0, afternoonSnack: 0, dryMeal: 0, lunch: 0, transport: 0 }, ...record.foodAllowance };
            
            await tx.foodAllowance.create({
              data: {
                attendanceId: attendanceRecord.id,
                breakfast: foodAllowance.breakfast,
                reinforcedBreakfast: foodAllowance.reinforcedBreakfast,
                snack1: foodAllowance.snack1,
                afternoonSnack: foodAllowance.afternoonSnack,
                dryMeal: foodAllowance.dryMeal,
                lunch: foodAllowance.lunch,
                transport: new Decimal(foodAllowance.transport.toFixed(2))
              }
            });

            // Crear registro de horas extras si aplica
            if (nightHours > 0 || supplementaryHours > 0 || extraordinaryHours > 0) {
              await tx.extraHours.create({
                data: {
                  attendanceId: attendanceRecord.id,
                  nightHours: new Decimal(nightHours.toFixed(2)),
                  supplementaryHours: new Decimal(supplementaryHours.toFixed(2)),
                  extraordinaryHours: new Decimal(extraordinaryHours.toFixed(2))
                }
              });
            }

            processedRecords.push({
              employeeId: record.employeeId,
              identification: employee.identification,
              name: `${employee.firstName} ${employee.lastName}`,
              area: employee.area?.name,
              workedHours,
              status: 'created'
            });

          } catch (recordError: any) {
            errors.push({
              index: i,
              employeeId: record.employeeId,
              identification: employee.identification,
              name: `${employee.firstName} ${employee.lastName}`,
              error: recordError.message
            });
          }
        }

        return { processedRecords, errors };
      });

      const endTime = Date.now();
      const timeElapsed = ((endTime - startTime) / 1000).toFixed(2);

      res.status(201).json({
        success: true,
        message: `Procesamiento completado en ${timeElapsed}s`,
        data: {
          date,
          processed: result.processedRecords.length,
          errors: result.errors.length,
          totalRequested: records.length,
          successRate: `${((result.processedRecords.length / records.length) * 100).toFixed(1)}%`,
          timeElapsed: `${timeElapsed}s`,
          processedRecords: result.processedRecords,
          ...(result.errors.length > 0 && {
            errors: result.errors.slice(0, 10), // Mostrar solo primeros 10 errores
            totalErrors: result.errors.length
          })
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

      const endTime = Date.now();
      const timeElapsed = ((endTime - startTime) / 1000).toFixed(2);

      console.error('Error en procesamiento masivo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor durante el procesamiento masivo',
        timeElapsed: `${timeElapsed}s`,
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * GET /api/attendance/verify
   * Verificar qué empleados ya tienen registro para una fecha
   * ÚTIL PARA MARÍA: Confirmar que el guardado masivo fue exitoso
   */
  static async verify(req: Request, res: Response): Promise<void> {
    try {
      const { date, areaIds } = verifyQuerySchema.parse(req.query);
      const dateObj = new Date(date);

      // Construir filtros
      const whereClause: any = {
        date: dateObj
      };

      if (areaIds && areaIds.length > 0) {
        whereClause.employee = {
          areaId: { in: areaIds }
        };
      }

      // Obtener registros existentes
      const existingRecords = await prisma.attendanceRecord.findMany({
        where: whereClause,
        include: {
          employee: {
            select: {
              id: true,
              identification: true,
              firstName: true,
              lastName: true,
              areaId: true,
              area: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          foodAllowance: true,
          extraHours: true
        },
        orderBy: [
          { employee: { area: { name: 'asc' } } },
          { employee: { lastName: 'asc' } },
          { employee: { firstName: 'asc' } }
        ]
      });

      // Obtener total de empleados activos (con filtro de áreas si aplica)
      const totalEmployeesQuery: any = {
        isActive: true
      };

      if (areaIds && areaIds.length > 0) {
        totalEmployeesQuery.areaId = { in: areaIds };
      }

      const totalEmployees = await prisma.employee.count({
        where: totalEmployeesQuery
      });

      // Agrupar por área
      const recordsByArea = existingRecords.reduce((acc: any, record) => {
        const areaName = record.employee.area?.name || 'Sin área';
        if (!acc[areaName]) {
          acc[areaName] = [];
        }
        acc[areaName].push({
          employeeId: record.employee.id,
          identification: record.employee.identification,
          fullName: `${record.employee.firstName} ${record.employee.lastName}`,
          entryTime: record.entryTime ? formatTimeToString(record.entryTime) : null,
          exitTime: record.exitTime ? formatTimeToString(record.exitTime) : null,
          workedHours: record.workedHours ? parseFloat(record.workedHours.toString()) : 0,
          isVacation: record.isVacation,
          foodAllowance: record.foodAllowance,
          extraHours: record.extraHours,
          createdAt: record.createdAt
        });
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          date,
          summary: {
            totalEmployees: areaIds ? `${totalEmployees} (en áreas filtradas)` : totalEmployees,
            registered: existingRecords.length,
            pending: totalEmployees - existingRecords.length,
            completionRate: `${((existingRecords.length / totalEmployees) * 100).toFixed(1)}%`
          },
          recordsByArea,
          areaStats: Object.keys(recordsByArea).map(areaName => ({
            area: areaName,
            registeredCount: recordsByArea[areaName].length
          }))
        },
        meta: {
          hasFilters: !!areaIds,
          filteredAreas: areaIds,
          totalRecordsFound: existingRecords.length
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Parámetros inválidos',
          errors: error.errors
        });
        return;
      }

      console.error('Error al verificar registros:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/attendance/daily-summary
   * Resumen diario de asistencia por área
   */
  static async getDailySummary(req: Request, res: Response): Promise<void> {
    try {
      const date = req.query.date as string;
      
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({
          success: false,
          message: 'Fecha requerida en formato YYYY-MM-DD'
        });
        return;
      }

      const dateObj = new Date(date);

      // Obtener resumen por área
      const summary = await prisma.area.findMany({
        select: {
          id: true,
          name: true,
          employees: {
            where: { isActive: true },
            select: {
              id: true,
              attendanceRecords: {
                where: { date: dateObj },
                include: {
                  foodAllowance: true,
                  extraHours: true
                }
              }
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      const areaStats = summary.map(area => {
        const totalEmployees = area.employees.length;
        const registeredEmployees = area.employees.filter(emp => emp.attendanceRecords.length > 0).length;
        const attendanceRecords = area.employees.flatMap(emp => emp.attendanceRecords);
        
        const vacationCount = attendanceRecords.filter(record => record.isVacation).length;
        const totalWorkedHours = attendanceRecords.reduce((sum, record) => 
          sum + (record.workedHours ? parseFloat(record.workedHours.toString()) : 0), 0
        );
        
        const totalFoodItems = attendanceRecords.reduce((sum, record) => {
          if (record.foodAllowance) {
            return sum + 
              record.foodAllowance.breakfast + 
              record.foodAllowance.reinforcedBreakfast + 
              record.foodAllowance.snack1 + 
              record.foodAllowance.afternoonSnack + 
              record.foodAllowance.dryMeal + 
              record.foodAllowance.lunch;
          }
          return sum;
        }, 0);

        return {
          areaId: area.id,
          areaName: area.name,
          totalEmployees,
          registeredEmployees,
          pendingEmployees: totalEmployees - registeredEmployees,
          completionRate: totalEmployees > 0 ? `${((registeredEmployees / totalEmployees) * 100).toFixed(1)}%` : '0%',
          vacationCount,
          totalWorkedHours: parseFloat(totalWorkedHours.toFixed(2)),
          totalFoodItems,
          averageWorkedHours: registeredEmployees > 0 ? parseFloat((totalWorkedHours / registeredEmployees).toFixed(2)) : 0
        };
      });

      const grandTotals = areaStats.reduce((acc, area) => ({
        totalEmployees: acc.totalEmployees + area.totalEmployees,
        registeredEmployees: acc.registeredEmployees + area.registeredEmployees,
        totalWorkedHours: acc.totalWorkedHours + area.totalWorkedHours,
        totalFoodItems: acc.totalFoodItems + area.totalFoodItems,
        vacationCount: acc.vacationCount + area.vacationCount
      }), { totalEmployees: 0, registeredEmployees: 0, totalWorkedHours: 0, totalFoodItems: 0, vacationCount: 0 });

      res.json({
        success: true,
        data: {
          date,
          summary: {
            ...grandTotals,
            pendingEmployees: grandTotals.totalEmployees - grandTotals.registeredEmployees,
            completionRate: grandTotals.totalEmployees > 0 ? 
              `${((grandTotals.registeredEmployees / grandTotals.totalEmployees) * 100).toFixed(1)}%` : '0%',
            averageWorkedHours: grandTotals.registeredEmployees > 0 ? 
              parseFloat((grandTotals.totalWorkedHours / grandTotals.registeredEmployees).toFixed(2)) : 0
          },
          areaStats
        }
      });

    } catch (error) {
      console.error('Error al obtener resumen diario:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}