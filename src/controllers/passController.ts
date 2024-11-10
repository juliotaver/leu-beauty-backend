// src/controllers/passController.ts
import { Request, Response } from 'express';
import { PassService } from '../services/passService';
import { pushNotificationService } from '../services/pushNotificationService';
import { db } from '../config/firebase';

const passService = new PassService();

export const passController = {
  // Mantener los métodos existentes
  generatePass: async (req: Request, res: Response) => {
    try {
      const passUrl = await passService.generatePass(req.body);
      res.json({ passUrl });
    } catch (error) {
      console.error('Error generating pass:', error);
      res.status(500).json({ error: 'Error generating pass' });
    }
  },

  // Nuevos métodos para la actualización de pases
  registerDevice: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      const { pushToken } = req.body;

      await pushNotificationService.registerDevice({
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber,
        pushToken
      });

      res.status(201).json({ message: 'Device registered successfully' });
    } catch (error) {
      console.error('Error registering device:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  unregisterDevice: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;

      await pushNotificationService.unregisterDevice(
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber
      );

      res.status(200).json({ message: 'Device unregistered successfully' });
    } catch (error) {
      console.error('Error unregistering device:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getSerialNumbers: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
      const { passesUpdatedSince } = req.query;

      const registrationsSnapshot = await db
        .collection('deviceRegistrations')
        .doc(deviceLibraryIdentifier)
        .get();

      if (!registrationsSnapshot.exists) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Obtener pases actualizados después de la fecha proporcionada
      const clientesSnapshot = await db
        .collection('clientes')
        .where('passTypeIdentifier', '==', passTypeIdentifier)
        .where('lastPassUpdate', '>', new Date(passesUpdatedSince as string))
        .get();

      const serialNumbers = clientesSnapshot.docs.map(doc => doc.id);

      res.status(200).json({ 
        serialNumbers,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting serial numbers:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getLatestPass: async (req: Request, res: Response) => {
    try {
      const { passTypeIdentifier, serialNumber } = req.params;
      
      // Obtener datos actualizados del cliente
      const clienteSnapshot = await db
        .collection('clientes')
        .doc(serialNumber)
        .get();

      if (!clienteSnapshot.exists) {
        return res.status(404).json({ error: 'Pass not found' });
      }

      const clienteData = clienteSnapshot.data();
      
      // Generar pase actualizado
      const passUrl = await passService.generatePass({
        id: serialNumber,
        ...clienteData
      });

      // Enviar el archivo .pkpass actualizado
      const passPath = await passService.getPassPath(passUrl.split('/').pop()!);
      res.sendFile(passPath);
    } catch (error) {
      console.error('Error getting latest pass:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};