// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { passRoutes, walletRoutes } from './routes/passRoutes';
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

// Middleware para logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Servir archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Rutas de generación de pases (sin autenticación)
app.use('/api/passes', passRoutes);

// Middleware de autenticación para rutas de Wallet
const walletAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.method === 'POST' && req.path === '/generate') {
    return next(); // Saltar autenticación para generación de pases
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('❌ No authorization header provided');
    return res.status(401).send();
  }
  
  console.log('✅ Auth header found:', authHeader);
  next();
};

// Rutas de Apple Wallet (con autenticación)
app.use('/api/v1', walletAuthMiddleware, walletRoutes);
app.use('/', walletAuthMiddleware, walletRoutes);

// Ruta para actualización de pases
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

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Logging de rutas al iniciar
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  
  // Imprimir todas las rutas registradas
  console.log('\n📍 Rutas registradas:');
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      const path = middleware.route.path;
      const methods = Object.keys(middleware.route.methods);
      console.log(`${methods.join(', ').toUpperCase()} ${path}`);
    }
  });
});

export default app;