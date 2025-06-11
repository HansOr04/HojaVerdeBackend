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

// CORS completamente permisivo
app.use(cors({
  origin: true, // Permite cualquier origen
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// Middleware adicional para preflight
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'Connected',
      server: 'Running',
      cors: 'PERMISSIVE MODE'
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
    timestamp: new Date().toISOString(),
    cors: 'PERMISSIVE MODE - All origins allowed',
    currentOrigin: req.headers.origin,
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      areas: '/api/areas',
      employees: '/api/employees',
      attendance: '/api/attendance'
    },
    status: {
      phase3_areas: '✅ COMPLETADA',
      phase4_employees: '✅ COMPLETADA',
      phase5_attendance: '✅ COMPLETADA',
      massiveRegistration: '🚀 READY - Sistema completo para 615 empleados'
    }
  });
});

// Importar rutas
import authRoutes from './infrastructure/http/routes/auth.routes';
import areaRoutes from './infrastructure/http/routes/areas.routes';
import employeeRoutes from './infrastructure/http/routes/employees.routes';
import attendanceRoutes from './infrastructure/http/routes/attendance.routes';

// Configurar rutas
app.use('/api/auth', authRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error no manejado:', err);
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    message: isDevelopment ? err.message : 'Error interno del servidor',
    ...(isDevelopment && { 
      stack: err.stack,
      details: err 
    }),
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`
🚀 Servidor HojaVerde iniciado exitosamente
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 URL Base: http://localhost:${PORT}
🌍 Ambiente: ${process.env.NODE_ENV || 'development'}
📊 Base de datos: PostgreSQL + Supabase ✅
🔒 CORS: PERMISSIVE MODE - Todos los orígenes permitidos
📝 Rate Limit: 100 req/15min por IP
💾 JSON Limit: 10MB (para bulk inserts)

🎉 SISTEMA COMPLETO - María puede registrar 615 empleados!
🚀 Rendimiento esperado: ~5-10 segundos para 615 registros
  `);
});

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM recibido, cerrando servidor...');
  server.close(async () => {
    console.log('✅ Servidor HTTP cerrado');
    await prisma.$disconnect();
    console.log('✅ Conexión a base de datos cerrada');
    console.log('✅ Servidor HojaVerde cerrado completamente');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT recibido (Ctrl+C), cerrando servidor...');
  server.close(async () => {
    console.log('✅ Servidor HTTP cerrado');
    await prisma.$disconnect();
    console.log('✅ Conexión a base de datos cerrada');
    console.log('✅ Servidor HojaVerde cerrado completamente');
    process.exit(0);
  });
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('💥 Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promise rechazada no manejada en:', promise, 'razón:', reason);
  process.exit(1);
});

export default app;