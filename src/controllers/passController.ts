// src/controllers/passController.ts
import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import { pushNotificationService } from '../services/pushNotificationService';
import { PassService } from '../services/passService';

const passService = new PassService();

interface ClienteData {
  pushToken?: string;
  passTypeIdentifier?: string;
  nombre: string;
  email: string;
  visitas: number;
  ultimaVisita: firestore.Timestamp;
  fechaRegistro: firestore.Timestamp;
  recompensasCanjeadas: string[];
  proximaRecompensa?: string;
}

export const passController = {
  // Método para generar el pase
  generatePass: async (req: Request, res: Response) => {
    try {
      const passUrl = await passService.generatePass(req.body);
      res.json({ passUrl });
    } catch (error) {
      console.error('Error generating pass:', error);
      res.status(500).json({ error: 'Error generating pass' });
    }
  },

  // Método actualizado para registrar el dispositivo
  registerDevice: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      const { pushToken } = req.body;

      console.log('Datos de registro recibidos:', {
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber,
        pushToken
      });

      const clienteRef = db.collection('clientes').doc(serialNumber);
      const clienteDoc = await clienteRef.get();

      if (!clienteDoc.exists) {
        console.error('Cliente no encontrado:', serialNumber);
        return res.status(404).send();
      }

      await db.collection('deviceRegistrations').doc(deviceLibraryIdentifier).set({
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber,
        pushToken,
        registeredAt: new Date(),
        lastUpdated: new Date()
      });

      await clienteRef.update({
        pushToken,
        deviceLibraryIdentifier,
        passTypeIdentifier,
        lastPassUpdate: new Date()
      });

      console.log('Registro completado exitosamente');
      res.status(201).send();
    } catch (error) {
      console.error('Error en registerDevice:', error);
      res.status(500).send();
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
      
      const clienteSnapshot = await db
        .collection('clientes')
        .doc(serialNumber)
        .get();

      if (!clienteSnapshot.exists) {
        return res.status(404).json({ error: 'Pass not found' });
      }

      const clienteData = clienteSnapshot.data();
      
      const passUrl = await passService.generatePass({
        id: serialNumber,
        ...clienteData
      });

      const passPath = await passService.getPassPath(passUrl.split('/').pop()!);
      res.sendFile(passPath);
    } catch (error) {
      console.error('Error getting latest pass:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Método para enviar notificación de actualización
  sendUpdateNotification: async (clienteId: string): Promise<void> => {
    try {
      const clienteRef = db.collection('clientes').doc(clienteId);
      const clienteDoc = await clienteRef.get();

      if (!clienteDoc.exists) {
        throw new Error('Cliente no encontrado');
      }

      const clienteData = clienteDoc.data() as ClienteData;
      
      if (!clienteData.pushToken) {
        const registrationSnapshot = await db
          .collection('deviceRegistrations')
          .where('serialNumber', '==', clienteId)
          .limit(1)
          .get();

        if (!registrationSnapshot.empty) {
          const registration = registrationSnapshot.docs[0].data();
          await clienteRef.update({
            pushToken: registration.pushToken,
            passTypeIdentifier: registration.passTypeIdentifier
          });
          clienteData.pushToken = registration.pushToken;
          clienteData.passTypeIdentifier = registration.passTypeIdentifier;
        }
      }

      if (!clienteData.pushToken) {
        throw new Error(`Cliente ${clienteId} no tiene token push o identificador de pase registrado`);
      }

      await pushNotificationService.sendUpdateNotification(clienteId);

    } catch (error) {
      console.error('Error en sendUpdateNotification:', error);
      throw error;
    }
  },

  // Manejar notificación de actualización desde la solicitud HTTP
  handleUpdateNotification: async (req: Request, res: Response) => {
    const { clienteId } = req.body;

    try {
      await passController.sendUpdateNotification(clienteId);
      res.status(200).json({ 
        message: 'Notificación enviada correctamente',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error enviando notificación:', error);
      res.status(500).json({ 
        error: 'Error al enviar notificación',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
};