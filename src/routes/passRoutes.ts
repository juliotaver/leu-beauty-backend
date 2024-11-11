// src/routes/passRoutes.ts
import express from 'express';
import { passController } from '../controllers/passController';

const router = express.Router();

// Ruta para generar pases
router.post('/generate', passController.generatePass);

// Rutas de Apple Wallet
router.post(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  passController.registerDevice
);

router.delete(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  passController.unregisterDevice
);

router.get(
  '/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  passController.getSerialNumbers
);

router.get(
  '/passes/:passTypeIdentifier/:serialNumber',
  passController.getLatestPass
);

export default router;