// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { passController } from './controllers/passController';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging para debug
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`🔍 ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Servir archivos estáticos
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Rutas de Apple Wallet
app.post('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    try {
      console.log('📱 Registro de dispositivo:', {
        deviceId: req.params.deviceLibraryIdentifier,
        passType: req.params.passTypeIdentifier,
        serialNumber: req.params.serialNumber,
        pushToken: req.body.pushToken
      });

      await passController.registerDevice(req, res);
    } catch (error) {
      console.error('❌ Error en registro:', error);
      res.status(500).send();
    }
});

app.get('/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  async (req: Request, res: Response) => {
    try {
      console.log('🔍 Buscando actualizaciones:', req.params);
      await passController.getSerialNumbers(req, res);
    } catch (error) {
      console.error('❌ Error buscando actualizaciones:', error);
      res.status(500).send();
    }
});

app.get('/passes/:passTypeIdentifier/:serialNumber',
  async (req: Request, res: Response) => {
    try {
      console.log('📲 Solicitando pase:', req.params);
      await passController.getLatestPass(req, res);
    } catch (error) {
      console.error('❌ Error obteniendo pase:', error);
      res.status(500).send();
    }
});

// Ruta para actualizar pase
app.post('/api/push/update-pass', async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.body;
    console.log('🔄 Actualizando pase para:', clienteId);
    await passController.sendUpdateNotification(clienteId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Error actualizando pase:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error desconocido' });
  }
});

// Ruta de logs
app.post('/log', (req: Request, res: Response) => {
  console.log('📝 Log de dispositivo:', req.body);
  res.status(200).send();
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`🚀 Servidor corriendo en puerto ${port}`));

export default app;