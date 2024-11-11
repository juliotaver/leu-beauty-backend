// src/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { passController } from './controllers/passController';
import passRoutes from './routes/passRoutes';
import { db } from './config/firebase';

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

// Rutas de Apple Wallet Pass
const webServiceRouter = express.Router();

// Registro de dispositivos
webServiceRouter.post(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    console.log('📱 Solicitud de registro de dispositivo recibida:', {
      params: req.params,
      body: req.body,
      headers: req.headers
    });
    
    try {
      await passController.registerDevice(req, res);
    } catch (error) {
      console.error('❌ Error en registro:', error);
      res.status(500).send();
    }
  }
);

// Obtener actualizaciones
webServiceRouter.get(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  async (req: Request, res: Response) => {
    console.log('🔄 Solicitud de actualizaciones recibida:', {
      params: req.params,
      query: req.query
    });
    
    try {
      await passController.getSerialNumbers(req, res);
    } catch (error) {
      console.error('❌ Error obteniendo actualizaciones:', error);
      res.status(500).send();
    }
  }
);

// Obtener pase actualizado
webServiceRouter.get(
  '/passes/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    console.log('📲 Solicitud de pase actualizado recibida:', {
      params: req.params
    });
    
    try {
      await passController.getLatestPass(req, res);
    } catch (error) {
      console.error('❌ Error obteniendo pase:', error);
      res.status(500).send();
    }
  }
);

// Dar de baja dispositivo
webServiceRouter.delete(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    console.log('🗑️ Solicitud de baja de dispositivo recibida:', {
      params: req.params
    });
    
    try {
      await passController.unregisterDevice(req, res);
    } catch (error) {
      console.error('❌ Error dando de baja dispositivo:', error);
      res.status(500).send();
    }
  }
);

// Middleware de autenticación para las rutas de Apple Wallet
app.use('/v1', (req: Request, res: Response, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send('Authorization header required');
  }
  
  // La autenticación viene en formato "ApplePass <token>"
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'ApplePass' || !token) {
    return res.status(401).send('Invalid authorization format');
  }
  
  // Aquí podrías verificar el token si lo necesitas
  next();
});

// Montar las rutas del webservice
app.use('/v1', webServiceRouter);

// Ruta de actualización de pases existente
app.post('/api/push/update-pass', async (req: Request, res: Response) => {
  const { clienteId } = req.body;
  
  if (!clienteId) {
    return res.status(400).json({ error: 'ClienteId es requerido' });
  }

  try {
    await passController.sendUpdateNotification(clienteId);
    res.status(200).json({ 
      message: 'Pase actualizado correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al actualizar pase:', error);
    res.status(500).json({ 
      error: 'Error al actualizar pase',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

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