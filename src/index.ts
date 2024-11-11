// src/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import passRoutes from './routes/passRoutes';
import { db } from './config/firebase';
import { passController } from './controllers/passController';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Configuración CORS
app.use(cors({
  origin: function(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
    callback(null, true); // Permitir todas las solicitudes por ahora para debugging
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'If-Modified-Since']
}));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
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

// Rutas principales de pases
app.use('/api/passes', passRoutes);

// Rutas específicas para el registro de dispositivos y actualización de pases
app.post('/api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', 
  async (req, res) => {
    console.log('Recibida solicitud de registro de dispositivo:', {
      params: req.params,
      body: req.body,
      headers: req.headers
    });
    
    try {
      await passController.registerDevice(req, res);
    } catch (error) {
      console.error('Error en el registro:', error);
      res.status(500).send();
    }
});

// Ruta para obtener actualizaciones de pases
app.get('/api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier', 
  async (req, res) => {
    try {
      await passController.getSerialNumbers(req, res);
    } catch (error) {
      console.error('Error obteniendo números de serie:', error);
      res.status(500).send();
    }
});

// Ruta para obtener la última versión del pase
app.get('/api/v1/passes/:passTypeIdentifier/:serialNumber', 
  async (req, res) => {
    try {
      await passController.getLatestPass(req, res);
    } catch (error) {
      console.error('Error obteniendo pase:', error);
      res.status(500).send();
    }
});

// Ruta para dar de baja un dispositivo
app.delete('/api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req, res) => {
    try {
      await passController.unregisterDevice(req, res);
    } catch (error) {
      console.error('Error dando de baja dispositivo:', error);
      res.status(500).send();
    }
});

// Ruta para actualizar el pase manualmente
app.post('/api/push/update-pass', passController.handleUpdateNotification);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Manejador de errores global
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

export default app;