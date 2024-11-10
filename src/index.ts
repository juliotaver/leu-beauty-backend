// src/index.ts
import express from 'express';
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

// Rutas específicas para el registro de dispositivos
app.post('/api/passes/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', 
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

app.post('/api/push/update-pass', async (req, res) => {
  const { clienteId } = req.body;
  
  if (!clienteId) {
    return res.status(400).json({ error: 'ClienteId es requerido' });
  }

  try {
    // Primero, verificar si el cliente tiene un pase registrado
    const clienteDoc = await db.collection('clientes').doc(clienteId).get();
    if (!clienteDoc.exists) {
      throw new Error('Cliente no encontrado');
    }

    const clienteData = clienteDoc.data();
    console.log('Datos del cliente para actualización:', clienteData);

    // Buscar registro del dispositivo si no hay token en el cliente
    if (!clienteData?.pushToken) {
      const registrationSnapshot = await db
        .collection('deviceRegistrations')
        .where('serialNumber', '==', clienteId)
        .limit(1)
        .get();

      if (!registrationSnapshot.empty) {
        const registration = registrationSnapshot.docs[0].data();
        await clienteDoc.ref.update({
          pushToken: registration.pushToken,
          passTypeIdentifier: registration.passTypeIdentifier
        });
      }
    }

    // Enviar notificación de actualización
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