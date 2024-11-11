// src/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { passController } from './controllers/passController';
import { db } from './config/firebase';
import { PushNotificationService } from './services/pushNotificationService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const pushNotificationService = new PushNotificationService();

// Configuración CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
// Middleware de logging mejorado
app.use((req, res, next) =>  {
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

  // Capturar la respuesta con tipado correcto
  const oldSend = res.send;
  res.send = function(body: any) {
    console.log(`📤 Respuesta [${res.statusCode}]:`, body);
    return oldSend.call(res, body);
  } as any;

  next();
});

// Rutas básicas
app.get('/health', (_, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/log', (req, res) => {
  console.log('📱 Wallet Log:', req.body);
  res.status(200).send();
});

// Ruta de generación de pases (sin auth)
app.post('/api/passes/generate', passController.generatePass);

// Middleware de autenticación
const authMiddleware = (req: Request, res: Response, next: Function) => {
  if (req.path.includes('/generate') || req.path.includes('/push/update-pass')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('ApplePass ')) {
    return res.status(401).send();
  }

  next();
};

// Rutas de Wallet (con auth) usando walletEndpoints
const walletEndpoints = [
  // Registro de dispositivo
  {
    method: 'post',
    path: '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
    handler: passController.registerDevice
  },
  // Baja de dispositivo
  {
    method: 'delete',
    path: '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
    handler: passController.unregisterDevice
  },
  // Obtener actualizaciones
  {
    method: 'get',
    path: '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
    handler: passController.getSerialNumbers
  },
  // Obtener pase actualizado
  {
    method: 'get',
    path: '/passes/:passTypeIdentifier/:serialNumber',
    handler: passController.getLatestPass
  }
];

// Montar las rutas de Wallet con el prefijo correcto
walletEndpoints.forEach(endpoint => {
  const handler = [authMiddleware, endpoint.handler];
  // Montar en /v1
  (app as any)[endpoint.method](`/v1${endpoint.path}`, ...handler);
  // También montar en /api/v1 si es necesario
  (app as any)[endpoint.method](`/api/v1${endpoint.path}`, ...handler);
});

// Ruta de actualización de pases (sin autenticación)
app.post('/api/push/update-pass', async (req, res) => {
  try {
    const { clienteId } = req.body;
    if (!clienteId) return res.status(400).json({ error: 'ClienteId requerido' });

    await pushNotificationService.sendUpdateNotification(clienteId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log('\n📍 Rutas disponibles:');
  
  const getRoutes = (stack: any[]): string[] => {
    return stack.reduce((routes: string[], layer: any) => {
      if (layer.route) {
        const method = Object.keys(layer.route.methods)[0].toUpperCase();
        routes.push(`${method} ${layer.route.path}`);
      }
      return routes;
    }, []);
  };

  getRoutes(app._router.stack).sort().forEach(route => console.log(route));
});

export default app;