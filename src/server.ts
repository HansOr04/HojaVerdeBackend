import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';

// Cargar variables de entorno
dotenv.config();

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3001;

// Inicializar Prisma
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de requests
  message: {
    success: false,
    message: 'Demasiadas peticiones desde esta IP, intenta más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' })); // Aumentado para soportar bulk inserts
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// Health check
app.get('/health', async (req, res) => {
  try {
    // Intentar hacer una consulta simple para verificar la conexión
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'Connected',
      server: 'Running'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(503).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'Disconnected',
      server: 'Running',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Database connection failed'
    });
  }
});

// Ruta base API
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API HojaVerde funcionando correctamente',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      areas: '/api/areas',
      employees: '/api/employees', // Próximamente
      attendance: '/api/attendance' // Próximamente
    },
    documentation: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        me: 'GET /api/auth/me',
        changePassword: 'POST /api/auth/change-password'
      },
      areas: {
        list: 'GET /api/areas',
        listWithEmployees: 'GET /api/areas?includeEmployees=true',
        search: 'GET /api/areas?search=cultivo',
        getById: 'GET /api/areas/:id',
        create: 'POST /api/areas (ADMIN only)',
        update: 'PUT /api/areas/:id (ADMIN only)',
        delete: 'DELETE /api/areas/:id (ADMIN only)'
      }
    }
  });
});

// Importar rutas
import authRoutes from './infrastructure/http/routes/auth.routes';
import areaRoutes from './infrastructure/http/routes/areas.routes';
// import employeeRoutes from './infrastructure/http/routes/employee.routes';

// Configurar rutas
app.use('/api/auth', authRoutes);
app.use('/api/areas', areaRoutes);
// app.use('/api/employees', employeeRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error no manejado:', err);
  
  // No enviar detalles del error en producción
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    message: isDevelopment ? err.message : 'Error interno del servidor',
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`
🚀 Servidor HojaVerde iniciado
📍 URL: http://localhost:${PORT}
🌍 Ambiente: ${process.env.NODE_ENV || 'development'}
📊 Base de datos: Conectada
🔒 CORS habilitado para: ${process.env.FRONTEND_URL || 'http://localhost:3000'}
📝 Documentación API: http://localhost:${PORT}/api

📋 Endpoints disponibles:
   🔐 Auth: http://localhost:${PORT}/api/auth
   🏢 Areas: http://localhost:${PORT}/api/areas
   ⏳ Employees: Próximamente
   ⏳ Attendance: Próximamente

✅ FASE 3 IMPLEMENTADA: CRUD de Áreas completo
⏳ FASE 4 SIGUIENTE: CRUD de Empleados por múltiples áreas
  `);
});

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado');
    prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado');
    prisma.$disconnect();
    process.exit(0);
  });
});

export default app;