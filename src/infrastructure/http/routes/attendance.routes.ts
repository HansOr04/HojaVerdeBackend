import { Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireEditor } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * POST /api/attendance/bulk
 * 🚨 CRÍTICO PARA MARÍA: Guardado masivo de registros de asistencia
 * Acceso: ADMIN y EDITOR
 * 
 * Body: {
 *   date: string (requerido, formato YYYY-MM-DD)
 *   registeredBy?: string (UUID del usuario, opcional)
 *   records: Array<{
 *     employeeId: string (UUID requerido)
 *     entryTime?: string (formato HH:mm)
 *     exitTime?: string (formato HH:mm)
 *     lunchDuration?: number (minutos, default: 30)
 *     isVacation?: boolean (default: false)
 *     permissionHours?: number (default: 0)
 *     permissionReason?: string
 *     foodAllowance?: {
 *       breakfast?: number (default: 0)
 *       reinforcedBreakfast?: number (default: 0)
 *       snack1?: number (default: 0)
 *       afternoonSnack?: number (default: 0)
 *       dryMeal?: number (default: 0)
 *       lunch?: number (default: 0)
 *       transport?: number (default: 0)
 *     }
 *   }>
 * }
 * 
 * Características:
 * - Procesa hasta 1000 registros por request
 * - Transacción atómica (todo o nada)
 * - Calcula horas trabajadas automáticamente
 * - Calcula horas extras por tipo
 * - Previene duplicados por empleado/fecha
 * - Response con estadísticas de procesamiento
 * 
 * Ejemplo para 3 empleados:
 * POST /api/attendance/bulk
 * {
 *   "date": "2025-01-06",
 *   "registeredBy": "user-uuid",
 *   "records": [
 *     {
 *       "employeeId": "emp1-uuid",
 *       "entryTime": "06:30",
 *       "exitTime": "16:00",
 *       "lunchDuration": 30,
 *       "isVacation": false,
 *       "foodAllowance": {
 *         "breakfast": 1,
 *         "lunch": 1,
 *         "transport": 2.50
 *       }
 *     },
 *     {
 *       "employeeId": "emp2-uuid",
 *       "entryTime": "06:30",
 *       "exitTime": "17:00",
 *       "lunchDuration": 30,
 *       "foodAllowance": {
 *         "breakfast": 1,
 *         "snack1": 1,
 *         "lunch": 1
 *       }
 *     },
 *     {
 *       "employeeId": "emp3-uuid",
 *       "isVacation": true,
 *       "foodAllowance": {
 *         "transport": 5.00
 *       }
 *     }
 *   ]
 * }
 */
router.post('/bulk', requireEditor, AttendanceController.bulkCreate);

export default router;