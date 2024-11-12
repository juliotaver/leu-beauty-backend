import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { passController } from './controllers/passController';
import { db } from './config/firebase';
import { firestore } from 'firebase-admin';
import { PushNotificationService } from './services/pushNotificationService';
import { deviceRegistrationService } from './services/deviceRegistrationService';

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

  // Capturar la respuesta
  const oldSend = res.send;
  res.send = function(body: any) {
    console.log(`📤 Respuesta [${res.statusCode}]:`, body);
    return oldSend.call(res, body);
  } as any;

  next();
});

// Servir archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Ruta de health check
app.get('/health', (_, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

// Middleware de autenticación
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Rutas que no requieren autenticación
  if (req.path === '/health' || 
      req.path === '/log' || 
      req.path.includes('/generate') || 
      req.path.includes('/push/update-pass')) {
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

// Aplicar middleware de autenticación globalmente
app.use(authMiddleware);

// Ruta para generar pases
app.post('/api/passes/generate', passController.generatePass);

// Rutas de Apple Wallet (corregidas sin el v1 duplicado)
app.post('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', 
  async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      const { pushToken } = req.body;

      console.log('📱 Registrando dispositivo:', {
        device: deviceLibraryIdentifier,
        pass: passTypeIdentifier,
        serial: serialNumber,
        token: pushToken
      });

      // Registrar usando deviceRegistrationService
      await deviceRegistrationService.registerDevice({
        deviceLibraryIdentifier,
        pushToken,
        passTypeIdentifier,
        serialNumber
      });

      console.log('✅ Dispositivo registrado exitosamente');
      res.status(201).send();
    } catch (error) {
      console.error('❌ Error en registro:', error);
      res.status(500).send();
    }
  }
);

app.delete('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      
      await deviceRegistrationService.unregisterDevice(
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber
      );
      
      res.status(200).send();
    } catch (error) {
      console.error('❌ Error en unregister:', error);
      res.status(500).send();
    }
  }
);

app.get('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
      const passesUpdatedSince = req.query.passesUpdatedSince as string;

      const clientesSnapshot = await db.collection('clientes')
        .where('passTypeIdentifier', '==', passTypeIdentifier)
        .where('deviceLibraryIdentifier', '==', deviceLibraryIdentifier)
        .get();

      const serialNumbers = clientesSnapshot.docs.map(doc => doc.id);

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

app.get('/v1/passes/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    try {
      const { passTypeIdentifier, serialNumber } = req.params;
      const result = await passController.getLatestPass(req, res);
      return result;
    } catch (error) {
      console.error('❌ Error obteniendo pase:', error);
      res.status(500).send();
    }
  }
);

// Ruta de logs
app.post('/v1/log', (req: Request, res: Response) => {
  console.log('📱 Apple Wallet Log:', req.body);
  res.status(200).send();
});

// Ruta de actualización de pases
app.post('/api/push/update-pass', async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.body;
    if (!clienteId) {
      return res.status(400).json({ error: 'ClienteId requerido' });
    }

    await pushNotificationService.sendUpdateNotification(clienteId);
    res.status(200).json({ 
      success: true, 
      message: 'Notificación enviada correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Error interno',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
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

  getRoutes(app._router.stack).sort().forEach(route => {
    console.log(`${route}`);
  });
});

export default app;