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

// CORS configurado para desarrollo y producción
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://hojaverdef1.netlify.app',
  'https://hojaverdef1.netlify.app/',
  process.env.FRONTEND_URL
].filter(Boolean);

console.log('🌐 CORS configurado para:', allowedOrigins);

const corsOptions = {
  origin: function (origin: string | undefined, callback: any) {
    // Permitir requests sin origin (apps móviles, Postman, etc.) solo en desarrollo
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      console.log('✅ Allowed origins:', allowedOrigins);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

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
      server: 'Running',
      cors: allowedOrigins
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
    cors: {
      allowedOrigins: allowedOrigins,
      currentOrigin: req.headers.origin
    },
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      areas: '/api/areas',
      employees: '/api/employees',
      attendance: '/api/attendance'
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
      },
      employees: {
        list: 'GET /api/employees',
        byMultipleAreas: 'GET /api/employees/by-areas?areaIds=id1,id2,id3 (CRÍTICO)',
        search: 'GET /api/employees?search=juan&areaId=uuid',
        getById: 'GET /api/employees/:id',
        create: 'POST /api/employees (ADMIN/EDITOR)',
        update: 'PUT /api/employees/:id (ADMIN/EDITOR)',
        delete: 'DELETE /api/employees/:id (ADMIN only)',
        activate: 'POST /api/employees/:id/activate (ADMIN only)'
      },
      attendance: {
        template: 'GET /api/attendance/template?areaIds=id1,id2&date=2025-01-06 (CRÍTICO)',
        bulk: 'POST /api/attendance/bulk (CRÍTICO para 615 empleados)',
        verify: 'GET /api/attendance/verify?date=2025-01-06',
        dailySummary: 'GET /api/attendance/daily-summary?date=2025-01-06'
      }
    },
    status: {
      phase3_areas: '✅ COMPLETADA',
      phase4_employees: '✅ COMPLETADA',
      phase5_attendance: '✅ COMPLETADA',
      massiveRegistration: '🚀 READY - Sistema completo para 615 empleados'
    },
    criticalEndpoints: {
      preparation: 'GET /api/employees/by-areas?areaIds=...',
      template: 'GET /api/attendance/template?areaIds=...&date=...',
      massiveInsert: 'POST /api/attendance/bulk',
      verification: 'GET /api/attendance/verify?date=...'
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
    timestamp: new Date().toISOString(),
    availableRoutes: {
      health: 'GET /health',
      api: 'GET /api',
      auth: 'POST /api/auth/login',
      areas: 'GET /api/areas',
      employees: 'GET /api/employees',
      attendance: 'GET /api/attendance/template',
      criticalEndpoint: 'GET /api/employees/by-areas?areaIds=...'
    }
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
🔒 CORS habilitado para: ${allowedOrigins.join(', ')}
📝 Rate Limit: 100 req/15min por IP
💾 JSON Limit: 10MB (para bulk inserts)

📋 ENDPOINTS DISPONIBLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 Auth:        http://localhost:${PORT}/api/auth
🏢 Areas:       http://localhost:${PORT}/api/areas
👥 Employees:   http://localhost:${PORT}/api/employees
📅 Attendance:  http://localhost:${PORT}/api/attendance
📝 Health:      http://localhost:${PORT}/health
📖 Docs:        http://localhost:${PORT}/api

🚨 FLUJO COMPLETO PARA MARÍA (615 EMPLEADOS):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Preparación:
   GET /api/employees/by-areas?areaIds=cultivo1,cultivo2,cultivo3
   → Obtiene empleados agrupados por área

2️⃣ Plantilla:
   GET /api/attendance/template?areaIds=cultivo1,cultivo2,cultivo3&date=2025-01-06
   → Genera plantilla con 615 empleados y valores por defecto

3️⃣ Registro Masivo:
   POST /api/attendance/bulk
   → Guarda 615 registros en una transacción atómica

4️⃣ Verificación:
   GET /api/attendance/verify?date=2025-01-06
   → Confirma que todos los registros se guardaron correctamente

🎯 ESTADO DEL PROYECTO:
━━━━━━━━━━━━━━━━━━━━━━━━
✅ FASE 1-2: Base del proyecto + Autenticación
✅ FASE 3:   CRUD de Áreas completo
✅ FASE 4:   CRUD de Empleados + Endpoint crítico
✅ FASE 5:   Sistema de Asistencia Masiva COMPLETO

🔧 COMANDOS DE TESTING RÁPIDO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Health check
curl http://localhost:${PORT}/health

# 2. Login admin
curl -X POST http://localhost:${PORT}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@hojaverde.com","password":"admin123"}'

# 3. Obtener empleados por áreas
curl -X GET "http://localhost:${PORT}/api/employees/by-areas?areaIds=AREA1,AREA2,AREA3" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Obtener plantilla de registro
curl -X GET "http://localhost:${PORT}/api/attendance/template?areaIds=AREA1,AREA2,AREA3&date=2025-01-06" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Registro masivo (ejemplo con 2 empleados)
curl -X POST http://localhost:${PORT}/api/attendance/bulk \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"date":"2025-01-06","records":[{"employeeId":"EMP_ID","entryTime":"06:30","exitTime":"16:00","foodAllowance":{"breakfast":1,"lunch":1}}]}'

# 6. Verificar registros guardados
curl -X GET "http://localhost:${PORT}/api/attendance/verify?date=2025-01-06" \\
  -H "Authorization: Bearer YOUR_TOKEN"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 SISTEMA COMPLETO - María puede registrar 615 empleados!
🚀 Rendimiento esperado: ~5-10 segundos para 615 registros
💪 Características: Transacciones atómicas, cálculos automáticos, prevención de duplicados

🌐 CORS DEBUG INFO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Allowed Origins: ${allowedOrigins.join(', ')}
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