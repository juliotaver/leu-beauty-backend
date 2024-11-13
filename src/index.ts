import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { passController } from './controllers/passController';
import { PushNotificationService } from './services/pushNotificationService';
import { deviceRegistrationService } from './services/deviceRegistrationService';
import { db } from './config/firebase';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const pushNotificationService = new PushNotificationService();

// Configuración CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'If-Modified-Since']
}));

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log('\n🔍 ====== Nueva Solicitud ======');
  console.log(`📍 Método: ${req.method}`);
  console.log(`📍 URL Original: ${req.originalUrl}`);
  console.log(`📍 URL Base: ${req.baseUrl}`);
  console.log(`📍 Ruta: ${req.path}`);
  console.log('📍 Parámetros:', req.params);
  console.log('🔒 Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  console.log('===============================\n');

  const oldSend = res.send;
  res.send = function (body: any) {
    console.log(`📤 Respuesta [${res.statusCode}]:`, body);
    return oldSend.call(res, body);
  } as any;

  next();
});

// Ruta raíz
app.get('/', (_, res) => {
  res.json({
    status: 'OK',
    message: 'Leu Beauty Lab API',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Ruta de health check
app.get('/health', (_, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// 1. Primero las rutas estáticas
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// 2. Middleware de autenticación para rutas de Wallet
const walletAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Saltar autenticación para logs
  if (req.path === '/log') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('❌ No authorization header for:', req.path);
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

// Aplicar el middleware de autenticación solo a las rutas /v1
app.use(walletAuthMiddleware);

// 3. Middleware de debugging para rutas de Wallet
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log('🎯 Wallet Route Debug:', {
    fullPath: req.originalUrl,
    path: req.path,
    method: req.method,
    params: req.params,
    baseUrl: req.baseUrl
  });
  next();
});

// Rutas de Wallet directamente definidas
app.post('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    try {
      console.log('📱 Registro de dispositivo:', {
        params: req.params,
        body: {
          ...req.body,
          pushToken: req.body.pushToken?.substring(0, 10) + '...'
        }
      });

      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      const { pushToken } = req.body;

      await deviceRegistrationService.registerDevice({
        deviceLibraryIdentifier,
        pushToken,
        passTypeIdentifier,
        serialNumber
      });

      return res.status(201).send();
    } catch (error) {
      console.error('❌ Error en registro:', error);
      return res.status(500).send();
    }
  }
);

app.delete('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      await deviceRegistrationService.unregisterDevice(deviceLibraryIdentifier, passTypeIdentifier, serialNumber);
      return res.status(200).send();
    } catch (error) {
      console.error('❌ Error en unregister:', error);
      return res.status(500).send();
    }
  }
);

app.get('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
      const passesUpdatedSince = req.query.passesUpdatedSince as string;

      const clientesSnapshot = await db.collection('clientes')
        .where('passTypeIdentifier', '==', passTypeIdentifier)
        .where('deviceLibraryIdentifier', '==', deviceLibraryIdentifier)
        .get();

      const serialNumbers = clientesSnapshot.docs.map((doc) => doc.id);

      if (serialNumbers.length > 0) {
        res.json({ serialNumbers });
      } else {
        res.status(204).send();
      }
    } catch (error) {
      console.error('❌ Error obteniendo registros:', error);
      res.status(500).send();
    }
  }
);

app.get('/passes/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    try {
      const result = await passController.getLatestPass(req, res);
      return result;
    } catch (error) {
      console.error('❌ Error obteniendo pase:', error);
      res.status(500).send();
    }
  }
);

app.post('/log', (req: Request, res: Response) => {
  console.log('📱 Apple Wallet Log:', req.body);
  res.status(200).send();
});

// Rutas de API (sin autenticación)
app.post('/api/passes/generate', passController.generatePass);
app.post('/api/push/update-pass', passController.sendUpdateNotification);

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log('\n📍 Rutas disponibles:');
  console.log('🛣️ Rutas activas en el servidor:');
app._router.stack.forEach((middleware: any) => {
  if (middleware.route) { // Si el middleware es una ruta
    console.log(`${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
  }
});
  
  const getRoutes = (stack: any[]): string[] => {
    return stack.reduce((routes: string[], layer: any) => {
      if (layer.route) {
        const method = Object.keys(layer.route.methods)[0].toUpperCase();
        routes.push(`${method} ${layer.route.path}`);
      }
      return routes;
    }, []);
  };

  getRoutes(app._router.stack).sort().forEach(route => {
    console.log(`${route}`);
  });
});

export default app;