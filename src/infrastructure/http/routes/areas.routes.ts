import { Router } from 'express';
import { AreasController } from '../controllers/AreasController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireAdmin, requireViewer } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/', requireViewer, AreasController.getAll);
router.get('/:id', requireViewer, AreasController.getById);
router.post('/', requireAdmin, AreasController.create);
router.put('/:id', requireAdmin, AreasController.update);
router.delete('/:id', requireAdmin, AreasController.delete);

export default router;