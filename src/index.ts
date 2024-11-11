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
app.use((req, res, next) => {
  console.log(`🔍 ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.body) console.log('Body:', req.body);
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

// Rutas de Wallet (con auth)
app.post('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', 
  authMiddleware, 
  passController.registerDevice
);

app.delete('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', 
  authMiddleware, 
  passController.unregisterDevice
);

app.get('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier', 
  authMiddleware, 
  passController.getSerialNumbers
);

app.get('/v1/passes/:passTypeIdentifier/:serialNumber', 
  authMiddleware, 
  passController.getLatestPass
);

// También montar las mismas rutas en /api/v1
app.post('/api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', 
  authMiddleware, 
  passController.registerDevice
);

app.delete('/api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', 
  authMiddleware, 
  passController.unregisterDevice
);

app.get('/api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier', 
  authMiddleware, 
  passController.getSerialNumbers
);

app.get('/api/v1/passes/:passTypeIdentifier/:serialNumber', 
  authMiddleware, 
  passController.getLatestPass
);

// Ruta de actualización
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