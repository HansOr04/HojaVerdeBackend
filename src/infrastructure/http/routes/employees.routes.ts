import { Router } from 'express';
import { EmployeesController } from '../controllers/EmployeesController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireAdmin, requireEditor, requireViewer } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/by-areas', requireViewer, EmployeesController.getByMultipleAreas);
router.get('/', requireViewer, EmployeesController.getAll);
router.get('/:id', requireViewer, EmployeesController.getById);
router.post('/', requireEditor, EmployeesController.create);
router.put('/:id', requireEditor, EmployeesController.update);
router.delete('/:id', requireAdmin, EmployeesController.delete);
router.post('/:id/activate', requireAdmin, EmployeesController.activate);

export default router;