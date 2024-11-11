// src/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import passRoutes from './routes/passRoutes';
import { passController } from './controllers/passController';
import { db } from './config/firebase';
import { PushNotificationService } from './services/pushNotificationService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const pushNotificationService = new PushNotificationService();

const allowedOrigins = [
  'http://localhost:3000',
  'https://admin.leubeautylab.com',
  'https://leu-beauty-frontend-efur7s2wv-julio-taveras-projects.vercel.app'
];

// Configuración CORS
app.use(cors({
  origin: function (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'If-Modified-Since']
}));

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging mejorado
app.use((req, res, next) => {
  console.log('\n🔍 Nueva solicitud:');
  console.log(`📍 ${req.method} ${req.url}`);
  console.log('🔒 Auth:', req.headers.authorization || 'No auth header');
  console.log('📄 Headers:', JSON.stringify(req.headers, null, 2));

  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }

  next();
});

// Rutas base primero
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.post('/log', (req: Request, res: Response) => {
  console.log('📱 Apple Wallet Log:', req.body);
  res.status(200).send();
});

// Ruta de push notifications
app.post('/api/push/update-pass', async (req, res) => {
  try {
    const { clienteId } = req.body;
    if (!clienteId) {
      return res.status(400).json({ error: 'ClienteId es requerido' });
    }
    await pushNotificationService.sendUpdateNotification(clienteId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Middleware de autenticación para rutas de Wallet
const walletAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Solo autenticar rutas de dispositivos y pases
  if (!req.path.includes('/devices/') && !req.path.includes('/passes/')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('❌ No auth header for:', req.path);
    return res.status(401).send();
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'ApplePass') {
    console.log('❌ Invalid auth scheme:', scheme);
    return res.status(401).send();
  }

  console.log('✅ Valid auth for:', req.path);
  next();
};

// Rutas de generación de pases (sin autenticación)
app.use('/api/passes/generate', passRoutes);

// Router para rutas de Wallet
const walletRoutes = express.Router();

// Rutas de registro y actualización de pases
walletRoutes.post(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  (req, res) => passController.registerDevice(req, res)
);

walletRoutes.delete(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  (req, res) => passController.unregisterDevice(req, res)
);

walletRoutes.get(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  (req, res) => passController.getSerialNumbers(req, res)
);

walletRoutes.get(
  '/passes/:passTypeIdentifier/:serialNumber',
  (req, res) => passController.getLatestPass(req, res)
);

// Montar las rutas de Wallet con autenticación
app.use('/v1', walletAuthMiddleware, walletRoutes);
app.use('/api/v1', walletAuthMiddleware, walletRoutes);

// Servir archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Logging de rutas al iniciar
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log('📍 Rutas disponibles:');

  const routes: string[] = [];

  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      // Rutas directas
      const path = middleware.route.path;
      const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
      routes.push(`${methods} ${path}`);
    } else if (middleware.name === 'router') {
      // Sub-routers
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          const path = handler.route.path;
          const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
          const fullPath = middleware.regexp.source
            .replace('/?(?=/|$)', '')
            .replace(/\\/g, '')
            .replace(/\^/g, '') + path;
          routes.push(`${methods} ${fullPath}`);
        }
      });
    }
  });

  // Imprimir rutas ordenadas
  routes.sort().forEach(route => console.log(route));
});

export default app;