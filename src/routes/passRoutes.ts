import { Router } from 'express';
import { 
  generatePass, 
  getPass, 
  registerDevice, 
  unregisterDevice,
  getSerialNumbers,
  handlePassUpdate
} from '../controllers/passController';

const router = Router();

// Rutas existentes
router.post('/generate', generatePass);
router.get('/:passId', getPass);

// Nuevas rutas para el servicio push
router.post('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', registerDevice);
router.delete('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', unregisterDevice);
router.get('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier', getSerialNumbers);
router.get('/v1/passes/:passTypeIdentifier/:serialNumber', handlePassUpdate);

export default router;