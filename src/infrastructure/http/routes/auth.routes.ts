import { Router, Request, Response } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AuthController();

// Rutas públicas
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  await controller.login(req, res);
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  await controller.register(req, res);
});

// Rutas protegidas
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  await controller.me(req, res);
});

router.post('/change-password', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  await controller.changePassword(req, res);
});

export default router;
