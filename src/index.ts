// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import passRoutes from './routes/passRoutes';
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
  origin: function(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
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

  // Capturar la respuesta
  const oldSend = res.send;
  res.send = function(data) {
    console.log(`📤 Response Status: ${res.statusCode}`);
    return oldSend.apply(res, arguments as any);
  };

  next();
});

// Middleware de autenticación actualizado
const walletAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Rutas que NO requieren autenticación
  if (req.path.includes('/generate') || 
      req.path.includes('/push/update-pass') || 
      req.path === '/health' || 
      req.path === '/log') {
    console.log('⏩ Saltando autenticación para ruta:', req.path);
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('❌ No authorization header for protected path:', req.path);
    return res.status(401).send();
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'ApplePass') {
    console.log('❌ Invalid authorization format');
    return res.status(401).send();
  }

  console.log('✅ Valid auth token:', token);
  next();
};

// Servir archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Ruta para logs de Apple Wallet
app.post('/log', (req, res) => {
  console.log('📱 Apple Wallet Log:', req.body);
  res.status(200).send();
});

// Ruta para actualización de pases (sin autenticación)
app.post('/api/push/update-pass', async (req, res) => {
  const { clienteId } = req.body;
  
  if (!clienteId) {
    return res.status(400).json({ error: 'ClienteId es requerido' });
  }

  try {
    // Obtener datos del cliente
    const clienteRef = db.collection('clientes').doc(clienteId);
    const clienteSnap = await clienteRef.get();

    if (!clienteSnap.exists) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Enviar notificación de actualización
    await pushNotificationService.sendUpdateNotification(clienteId);
    
    res.status(200).json({ 
      message: 'Notificación de actualización enviada correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al enviar notificación de actualización:', error);
    res.status(500).json({ 
      error: 'Error al enviar notificación de actualización',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Rutas de generación de pases
app.use('/api/passes', passRoutes);

// Rutas de Wallet
const walletRouter = express.Router();
walletRouter.use(walletAuthMiddleware);
walletRouter.use('/', passRoutes);

// Montar el router de Wallet en ambas rutas
app.use('/v1', walletRouter);
app.use('/api/v1', walletRouter);

// Logging de rutas al iniciar
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log('📍 Rutas disponibles:');
  
  function printRoutes(stack: any[], prefix = '') {
    stack.forEach(r => {
      if (r.route) {
        const methods = Object.keys(r.route.methods).join(',').toUpperCase();
        console.log(`${methods} ${prefix}${r.route.path}`);
      } else if (r.name === 'router') {
        printRoutes(r.handle.stack, prefix + r.regexp.source.replace(/\\/g, '').replace(/\?\(\?=\/\|\$\)/i, ''));
      }
    });
  }
  
  printRoutes(app._router.stack);
});

export default app;