import { Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireEditor } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/template', requireEditor, AttendanceController.getTemplate);
router.post('/bulk', requireEditor, AttendanceController.bulkCreate);
router.get('/verify', requireEditor, AttendanceController.verify);
router.get('/daily-summary', requireEditor, AttendanceController.getDailySummary);

export default router;