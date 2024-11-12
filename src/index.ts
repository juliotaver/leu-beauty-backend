import express, { Request, Response, NextFunction, Router } from 'express';
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
const walletRouter = Router();
const pushNotificationService = new PushNotificationService();

// Función para imprimir rutas
function printRoutes(app: express.Application) {
  console.log('\n🛣️  Rutas registradas:');
  function print(path: string, layer: any) {
    if (layer.route) {
      layer.route.stack.forEach((stack: any) => {
        console.log('%s %s', stack.method.toUpperCase(), path.concat(layer.route.path));
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach((stack: any) => {
        print(path.concat(layer.regexp.source.replace("^","").replace("/?(?=\\/|$)","").replace(/\\\//g, "/")), 
              stack);
      });
    }
  }
  app._router.stack.forEach((layer: any) => {
    print('', layer);
  });
}

// Primero, añadimos un middleware para permitir puntos en las URLs
app.use((req, res, next) => {
  req.url = decodeURIComponent(req.url);
  next();
});

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

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log('🔍 Incoming Request:', {
    originalUrl: req.originalUrl,
    decodedUrl: decodeURIComponent(req.originalUrl),
    method: req.method,
    headers: {
      host: req.headers.host,
      authorization: req.headers.authorization ? 'Present' : 'None',
    }
  });
  next();
});

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

  const oldSend = res.send;
  res.send = function(body: any) {
    console.log(`📤 Respuesta [${res.statusCode}]:`, body);
    return oldSend.call(res, body);
  } as any;

  next();
});

// Ruta raíz
app.get('/', (_, res) => {
  res.json({ 
    status: 'OK',
    message: 'Leu Beauty Lab API',
    version: '1.0.0',
    environment: process.env.NODE_ENV 
  });
});

// Ruta de health check
app.get('/health', (_, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

// Servir archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Middleware de autenticación para rutas de Apple Wallet
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/log') {
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

// Configurar rutas de Apple Wallet
walletRouter.use(authMiddleware);

walletRouter.use((req: Request, res: Response, next: NextFunction) => {
  console.log('🎫 Wallet Route:', {
    method: req.method,
    originalUrl: req.originalUrl,
    path: req.path,
    params: req.params,
    body: req.body
  });
  next();
});

// Modificamos cómo definimos las rutas del wallet
walletRouter.post('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier([^/]*?)/:serialNumber', 
  async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      const { pushToken } = req.body;

      console.log('📱 Recibida solicitud de registro:', {
        deviceId: deviceLibraryIdentifier,
        passType: passTypeIdentifier,  // Debería mostrar pass.com.salondenails.loyalty correctamente
        serialNumber,
        pushToken: pushToken?.substring(0, 10) + '...'
      });

      await deviceRegistrationService.registerDevice({
        deviceLibraryIdentifier,
        pushToken,
        passTypeIdentifier,
        serialNumber
      });

      console.log('✅ Dispositivo registrado exitosamente');
      return res.status(201).send();
    } catch (error) {
      console.error('❌ Error en registro:', error);
      return res.status(500).send();
    }
  }
);

walletRouter.get('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier([^/]*?)',
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

walletRouter.delete('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier([^/]*?)/:serialNumber',
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

walletRouter.get('/passes/:passTypeIdentifier([^/]*?)/:serialNumber',
  async (req: Request, res: Response) => {
    try {
      const result = await passController.getLatestPass(req, res);
      return result;
    } catch (error) {
      console.error('❌ Error obteniendo pase:', error);
      res.status(500).send();
    }
  }
);

walletRouter.post('/log', (req: Request, res: Response) => {
  console.log('📱 Apple Wallet Log:', req.body);
  res.status(200).send();
});

// Montar las rutas de Wallet
app.use('/v1', walletRouter);

// Rutas de API
app.post('/api/passes/generate', passController.generatePass);

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

// Imprimir todas las rutas registradas
printRoutes(app);

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log('\n📍 Rutas disponibles:');
});