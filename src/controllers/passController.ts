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

  // Método para registrar el dispositivo
  registerDevice: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      const { pushToken } = req.body;

      console.log('Registrando dispositivo:', {
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber,
        pushToken
      });

      // Primero, verificar si el cliente existe
      const clienteRef = db.collection('clientes').doc(serialNumber);
      const clienteDoc = await clienteRef.get();

      if (!clienteDoc.exists) {
        console.error('Cliente no encontrado:', serialNumber);
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      // Registrar el dispositivo y actualizar el cliente
      await Promise.all([
        // Guardar en la colección de registros de dispositivos
        db.collection('deviceRegistrations').doc(deviceLibraryIdentifier).set({
          passTypeIdentifier,
          serialNumber,
          pushToken,
          timestamp: new Date(),
          lastUpdated: new Date()
        }),

        // Actualizar el documento del cliente con la información del dispositivo
        clienteRef.update({
          pushToken,
          deviceLibraryIdentifier,
          passTypeIdentifier,
          lastPassUpdate: new Date()
        })
      ]);

      console.log('Dispositivo registrado exitosamente');
      res.status(201).json({ message: 'Device registered successfully' });
    } catch (error) {
      console.error('Error registering device:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Método para anular el registro del dispositivo
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

  // Obtener serial numbers de los pases actualizados
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

  // Obtener el pase actualizado más reciente
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
  },

  // Método para enviar notificación de actualización
  async sendUpdateNotification(clienteId: string): Promise<void> {
    try {
      const clienteRef = db.collection('clientes').doc(clienteId);
      const clienteSnap = await clienteRef.get();

      if (!clienteSnap.exists) {
        throw new Error('Cliente no encontrado');
      }

      const clienteData = clienteSnap.data();
      
      if (!clienteData?.pushToken || !clienteData?.passTypeIdentifier) {
        console.log('Datos del cliente:', clienteData);
        throw new Error(`Cliente ${clienteId} no tiene token push o identificador de pase registrado`);
      }

      // Regenerar el pase con los datos actualizados
      const passService = new PassService();
      await passService.generatePass({
        id: clienteId,
        ...clienteData
      });

      // Enviar la notificación push
      await pushNotificationService.sendUpdateNotification(clienteId);

      console.log('Notificación enviada exitosamente para cliente:', clienteId);
    } catch (error) {
      console.error('Error en sendUpdateNotification:', error);
      throw error;
    }
  }
};