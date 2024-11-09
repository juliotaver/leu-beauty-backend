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

const allowedOrigins = [
  'http://localhost:3000',
  'https://admin.leubeautylab.com',
  'https://leu-beauty-frontend-efur7s2wv-julio-taveras-projects.vercel.app'
];

// Configurar CORS
app.use(cors({
  origin: function(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// Middlewares
app.use(express.json());

// Servir archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Rutas
app.use('/api/passes', passRoutes);

// Ruta para registrar dispositivos
app.post('/api/passes/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', async (req, res) => {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
  const { pushToken } = req.body;

  try {
    await db.collection('registeredDevices').doc(deviceLibraryIdentifier).set({
      passTypeIdentifier,
      serialNumber,
      pushToken,
    });
    console.log(`Dispositivo registrado: ${deviceLibraryIdentifier}`);
    res.sendStatus(201);
  } catch (error) {
    console.error('Error al registrar el dispositivo:', error);
    res.sendStatus(500);
  }
});

// Nueva ruta para enviar notificación de actualización de pase
app.post('/api/push/update-pass', async (req, res) => {
  const { clienteId } = req.body;
  if (!clienteId) {
    return res.status(400).json({ error: 'ClienteId es requerido' });
  }

  try {
    await pushNotificationService.sendUpdateNotification(clienteId);
    res.status(200).json({ message: 'Notificación de actualización enviada correctamente' });
  } catch (error) {
    console.error('Error al enviar notificación de actualización:', error);
    res.status(500).json({ error: 'Error al enviar notificación de actualización' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});