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

// Middleware de autenticación para las rutas de pases
const authMiddleware = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).send();
    }

    // El header debe ser "ApplePass <token>"
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'ApplePass' || !token) {
      console.log('❌ Invalid authorization format');
      return res.status(401).send();
    }

    // El token debe coincidir con el serialNumber del pase
    const serialNumber = req.params.serialNumber;
    if (serialNumber && token !== serialNumber) {
      console.log('❌ Token mismatch');
      return res.status(401).send();
    }

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(401).send();
  }
};

// Aplicar autenticación a las rutas de pases
app.use('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', authMiddleware);
app.use('/passes/:passTypeIdentifier/:serialNumber', authMiddleware);

// Rutas para el webservice de pases (TODAS sin /api/ ni /v1/)
app.post('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    console.log('📱 Recibida solicitud de registro:', {
      params: req.params,
      body: req.body,
      auth: req.headers.authorization
    });
    await passController.registerDevice(req, res);
});

app.delete('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    console.log('🗑️ Solicitando baja de dispositivo:', {
      params: req.params
    });
    await passController.unregisterDevice(req, res);
});

app.get('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  async (req: Request, res: Response) => {
    console.log('🔍 Buscando actualizaciones:', {
      params: req.params,
      query: req.query
    });
    await passController.getSerialNumbers(req, res);
});

app.get('/passes/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    console.log('📲 Solicitando pase actualizado:', {
      params: req.params
    });
    await passController.getLatestPass(req, res);
});


app.delete('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    console.log('🗑️ Solicitando baja de dispositivo:', {
      params: req.params
    });
    await passController.unregisterDevice(req, res);
});

// Ruta para logs (opcional pero útil para debugging)
app.post('/log', (req: Request, res: Response) => {
  console.log('📝 Logs del dispositivo:', req.body);
  res.status(200).send();
});

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