import { Router } from 'express';
import { AreasController } from '../controllers/AreasController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireAdmin, requireViewer } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/areas
 * Listar todas las áreas con filtros opcionales
 * Acceso: Todos los roles autenticados
 * 
 * Query params:
 * - includeEmployees: 'true' | 'false' (default: false)
 * - search: string (filtrar por nombre)
 * 
 * Ejemplos:
 * GET /api/areas
 * GET /api/areas?includeEmployees=true
 * GET /api/areas?search=cultivo
 * GET /api/areas?includeEmployees=true&search=postcosecha
 */
router.get('/', requireViewer, AreasController.getAll);

/**
 * GET /api/areas/:id
 * Obtener área específica con empleados
 * Acceso: Todos los roles autenticados
 * 
 * Ejemplo:
 * GET /api/areas/550e8400-e29b-41d4-a716-446655440000
 */
router.get('/:id', requireViewer, AreasController.getById);

/**
 * POST /api/areas
 * Crear nueva área
 * Acceso: Solo ADMIN
 * 
 * Body: {
 *   name: string (requerido, se convierte a mayúsculas)
 *   defaultEntryTime: string (requerido, formato HH:mm)
 *   defaultExitTime: string (requerido, formato HH:mm)
 *   defaultLunchDuration?: number (opcional, default: 30 minutos)
 * }
 * 
 * Ejemplo:
 * POST /api/areas
 * {
 *   "name": "CULTIVO 5", 
 *   "defaultEntryTime": "06:30",
 *   "defaultExitTime": "16:00",
 *   "defaultLunchDuration": 30
 * }
 */
router.post('/', requireAdmin, AreasController.create);

/**
 * PUT /api/areas/:id
 * Actualizar área existente
 * Acceso: Solo ADMIN
 * 
 * Body: Cualquier campo del área (todos opcionales)
 * {
 *   name?: string
 *   defaultEntryTime?: string (formato HH:mm)
 *   defaultExitTime?: string (formato HH:mm)
 *   defaultLunchDuration?: number
 * }
 * 
 * Ejemplo:
 * PUT /api/areas/550e8400-e29b-41d4-a716-446655440000
 * {
 *   "defaultLunchDuration": 45
 * }
 */
router.put('/:id', requireAdmin, AreasController.update);

/**
 * DELETE /api/areas/:id
 * Eliminar área permanentemente
 * Solo se puede eliminar si no tiene empleados activos
 * Acceso: Solo ADMIN
 * 
 * Ejemplo:
 * DELETE /api/areas/550e8400-e29b-41d4-a716-446655440000
 */
router.delete('/:id', requireAdmin, AreasController.delete);

export default router;