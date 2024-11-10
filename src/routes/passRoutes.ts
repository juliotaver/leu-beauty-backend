// src/routes/passRoutes.ts
import express from 'express';
import { passController } from '../controllers/passController';

const router = express.Router();

// Rutas existentes
router.post('/generate', passController.generatePass);

// Nuevas rutas para actualizaciones de pases
router.post(
  '/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  passController.registerDevice
);

router.delete(
  '/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
  passController.unregisterDevice
);

router.get(
  '/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
  passController.getSerialNumbers
);

router.get(
  '/v1/passes/:passTypeIdentifier/:serialNumber',
  passController.getLatestPass
);

export default router;