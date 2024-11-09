import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import passRoutes from './routes/passRoutes';
import { db } from './config/firebase';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:3000',
  'https://admin.leubeautylab.com',
  'https://leu-beauty-frontend-efur7s2wv-julio-taveras-projects.vercel.app'
];

// Configurar CORS
app.use(cors({
  origin: function(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
    // Permitir requests sin origin (como mobile apps o curl)
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

app.post('/api/passes/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', async (req, res) => {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
  const { pushToken } = req.body;

  try {
    // Guardar la información del dispositivo en Firestore
    await db.collection('registeredDevices').doc(deviceLibraryIdentifier).set({
      passTypeIdentifier,
      serialNumber,
      pushToken,
    });

    console.log(`Dispositivo registrado: ${deviceLibraryIdentifier}`);
    res.sendStatus(201); // Devuelve un estado 201 indicando éxito
  } catch (error) {
    console.error('Error al registrar el dispositivo:', error);
    res.sendStatus(500); // Devuelve un estado 500 en caso de error
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