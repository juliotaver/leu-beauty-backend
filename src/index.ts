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

// Lista de orígenes permitidos
const allowedOrigins = [
  'http://localhost:3000',
  'https://admin.leubeautylab.com',
  'https://leu-beauty-frontend-efur7s2wv-julio-taveras-projects.vercel.app'
];

// Configuración de CORS
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

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Middleware para autenticación de pases de Apple Wallet
app.use('/api/passes/v1', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  // Aquí podrías implementar una validación más robusta si lo necesitas
  next();
});

// Servir archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Rutas principales
app.use('/api/passes', passRoutes);

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

// Manejador de errores global
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📁 Static files served from: ${path.join(__dirname, '../public/passes')}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;