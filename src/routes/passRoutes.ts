// src/routes/passRoutes.ts
import express from 'express';
import { passController } from '../controllers/passController';

const router = express.Router();

// Ruta de generación de pase (sin autenticación)
router.post('/generate', passController.generatePass);

// Rutas de Apple Wallet (con autenticación)
const walletRoutes = express.Router();

walletRoutes.post(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  passController.registerDevice
);

walletRoutes.delete(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  passController.unregisterDevice
);

walletRoutes.get(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  passController.getSerialNumbers
);

walletRoutes.get(
  '/passes/:passTypeIdentifier/:serialNumber',
  passController.getLatestPass
);

// Exportar ambos routers
export { router as passRoutes, walletRoutes };