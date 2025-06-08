import { Router } from 'express';
import { EmployeesController } from '../controllers/EmployeesController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireAdmin, requireEditor, requireViewer } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/employees/by-areas
 * 🚨 CRÍTICO PARA MARÍA: Obtener empleados de múltiples áreas para registro masivo
 * Acceso: Todos los roles autenticados
 * 
 * Query params:
 * - areaIds: string (requerido) - IDs de áreas separados por comas
 * 
 * Ejemplos:
 * GET /api/employees/by-areas?areaIds=area1-id,area2-id,area3-id
 * 
 * Response agrupado por área con valores por defecto para asistencia
 */
router.get('/by-areas', requireViewer, EmployeesController.getByMultipleAreas);

/**
 * GET /api/employees
 * Listar empleados con filtros y paginación
 * Acceso: Todos los roles autenticados
 * 
 * Query params:
 * - areaId: string (filtrar por área específica)
 * - areaIds: string (filtrar por múltiples áreas, separadas por comas)
 * - activeOnly: 'true' | 'false' (default: true)
 * - search: string (buscar por identificación, nombre o apellido)
 * - page: number (default: 1)
 * - limit: number (default: 50, máximo: 500)
 * 
 * Ejemplos:
 * GET /api/employees
 * GET /api/employees?areaId=area-uuid
 * GET /api/employees?areaIds=area1-uuid,area2-uuid
 * GET /api/employees?search=juan&activeOnly=true
 * GET /api/employees?page=2&limit=100
 */
router.get('/', requireViewer, EmployeesController.getAll);

/**
 * GET /api/employees/:id
 * Obtener empleado específico con detalles completos
 * Acceso: Todos los roles autenticados
 * 
 * Ejemplo:
 * GET /api/employees/550e8400-e29b-41d4-a716-446655440000
 */
router.get('/:id', requireViewer, EmployeesController.getById);

/**
 * POST /api/employees
 * Crear nuevo empleado
 * Acceso: ADMIN y EDITOR
 * 
 * Body: {
 *   identification: string (requerido, solo números, 8-20 caracteres)
 *   firstName: string (requerido, se convierte a mayúsculas)
 *   lastName: string (requerido, se convierte a mayúsculas)
 *   areaId?: string (UUID del área)
 *   position?: string (cargo)
 *   baseSalary?: number (salario base)
 * }
 * 
 * Ejemplo:
 * POST /api/employees
 * {
 *   "identification": "1234567890",
 *   "firstName": "Juan Carlos",
 *   "lastName": "Pérez García",
 *   "areaId": "area-uuid",
 *   "position": "Trabajador Agrícola",
 *   "baseSalary": 450.00
 * }
 */
router.post('/', requireEditor, EmployeesController.create);

/**
 * PUT /api/employees/:id
 * Actualizar empleado existente
 * Acceso: ADMIN y EDITOR
 * 
 * Body: Cualquier campo del empleado (todos opcionales)
 * {
 *   identification?: string
 *   firstName?: string
 *   lastName?: string
 *   areaId?: string
 *   position?: string
 *   baseSalary?: number
 * }
 * 
 * Ejemplo:
 * PUT /api/employees/550e8400-e29b-41d4-a716-446655440000
 * {
 *   "areaId": "new-area-uuid",
 *   "position": "Supervisor de Campo",
 *   "baseSalary": 550.00
 * }
 */
router.put('/:id', requireEditor, EmployeesController.update);

/**
 * DELETE /api/employees/:id
 * Desactivar empleado (soft delete)
 * También desactiva el usuario asociado si existe
 * Acceso: Solo ADMIN
 * 
 * Ejemplo:
 * DELETE /api/employees/550e8400-e29b-41d4-a716-446655440000
 */
router.delete('/:id', requireAdmin, EmployeesController.delete);

/**
 * POST /api/employees/:id/activate
 * Reactivar empleado desactivado
 * También reactiva el usuario asociado si existe
 * Acceso: Solo ADMIN
 * 
 * Ejemplo:
 * POST /api/employees/550e8400-e29b-41d4-a716-446655440000/activate
 */
router.post('/:id/activate', requireAdmin, EmployeesController.activate);

export default router;