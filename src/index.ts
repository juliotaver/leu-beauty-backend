// src/index.ts
import express, { Request, Response, NextFunction, Router } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { passController } from './controllers/passController';
import passRoutes from './routes/passRoutes';
import { db } from './config/firebase';

interface Route {
  path: string;
  methods: string[];
}

interface RouterStack {
  route?: {
    path: string;
    methods: {
      [key: string]: boolean;
    };
  };
}

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Configuración CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'If-Modified-Since']
}));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Servir archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Middleware de autenticación para pases de Apple Wallet
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('Auth header:', authHeader);
    
    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).send();
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'ApplePass' || !token) {
      console.log('❌ Invalid authorization format');
      return res.status(401).send();
    }

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

// Rutas de la API web
app.use('/api/passes', passRoutes);

// Rutas de Apple Wallet
const walletRouter = express.Router();

walletRouter.post('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  authMiddleware,
  async (req: Request, res: Response) => {
    console.log('📱 Recibida solicitud de registro:', {
      params: req.params,
      body: req.body,
      auth: req.headers.authorization
    });
    await passController.registerDevice(req, res);
});

walletRouter.delete('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  authMiddleware,
  async (req: Request, res: Response) => {
    console.log('🗑️ Solicitando baja de dispositivo:', {
      params: req.params
    });
    await passController.unregisterDevice(req, res);
});

walletRouter.get('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  authMiddleware,
  async (req: Request, res: Response) => {
    console.log('🔍 Buscando actualizaciones:', {
      params: req.params,
      query: req.query
    });
    await passController.getSerialNumbers(req, res);
});

walletRouter.get('/passes/:passTypeIdentifier/:serialNumber',
  authMiddleware,
  async (req: Request, res: Response) => {
    console.log('📲 Solicitando pase actualizado:', {
      params: req.params
    });
    await passController.getLatestPass(req, res);
});

// Montar las rutas de Apple Wallet
app.use('/', walletRouter);

// Ruta de logs para Apple Wallet
app.post('/log', (req: Request, res: Response) => {
  console.log('📝 Logs del dispositivo:', req.body);
  res.status(200).send();
});

// Ruta de actualización de pases
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
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Debug route para ver todas las rutas registradas
app.get('/debug/routes', (req: Request, res: Response) => {
  const routes: Route[] = [];
  
  app._router.stack.forEach((middleware: RouterStack) => {
    if(middleware.route){
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    }
  });
  
  res.json(routes);
});

// Manejador de errores global
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Imprimir todas las rutas al iniciar
app._router.stack.forEach((r: RouterStack) => {
    if (r.route && r.route.path){
        console.log(`${Object.keys(r.route.methods)} ${r.route.path}`);
    }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

export default app;