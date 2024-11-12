// src/controllers/passController.ts

import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import { pushNotificationService } from '../services/pushNotificationService';
import { PassService } from '../services/passService';
import { deviceRegistrationService } from '../services/deviceRegistrationService';

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

interface DeviceRegistration {
  deviceLibraryIdentifier: string;
  pushToken: string;
  passTypeIdentifier: string;
  serialNumber: string;
}

export const passController = {
  generatePass: async (req: Request, res: Response) => {
    try {
      console.log('📝 Generando pase para:', req.body);
      const passUrl = await passService.generatePass(req.body);
      res.json({ passUrl });
    } catch (error) {
      console.error('❌ Error generating pass:', error);
      res.status(500).json({ error: 'Error generating pass' });
    }
  },

  registerDevice: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      const { pushToken } = req.body;

      console.log('📱 Intento de registro:', {
        device: deviceLibraryIdentifier,
        pass: passTypeIdentifier,
        serial: serialNumber,
        token: pushToken,
        auth: req.headers.authorization
      });

      // Verificar que el cliente existe
      const clienteRef = db.collection('clientes').doc(serialNumber);
      const clienteDoc = await clienteRef.get();

      if (!clienteDoc.exists) {
        console.error('❌ Cliente no encontrado:', serialNumber);
        return res.status(404).send();
      }

      // Registrar usando deviceRegistrationService
      await deviceRegistrationService.registerDevice({
        deviceLibraryIdentifier,
        pushToken,
        passTypeIdentifier,
        serialNumber
      });

      console.log('✅ Dispositivo registrado exitosamente');
      res.status(201).send();
    } catch (error) {
      console.error('❌ Error en registro:', error);
      res.status(500).send();
    }
  },

  unregisterDevice: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;

      console.log('🗑️ Solicitud de baja de dispositivo:', {
        device: deviceLibraryIdentifier,
        pass: passTypeIdentifier,
        serial: serialNumber
      });

      await deviceRegistrationService.unregisterDevice(
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber
      );

      console.log('✅ Dispositivo dado de baja exitosamente');
      res.status(200).send();
    } catch (error) {
      console.error('❌ Error dando de baja dispositivo:', error);
      res.status(500).send();
    }
  },

  getSerialNumbers: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
      const passesUpdatedSince = req.query.passesUpdatedSince as string;

      console.log('🔍 Buscando actualizaciones:', {
        device: deviceLibraryIdentifier,
        pass: passTypeIdentifier,
        since: passesUpdatedSince
      });

      // Verificar que el dispositivo está registrado
      const registration = await deviceRegistrationService.getDeviceRegistration(deviceLibraryIdentifier);

      if (!registration) {
        console.log('❌ Dispositivo no registrado');
        return res.status(404).send();
      }

      // Buscar clientes actualizados
      const query = db.collection('clientes')
        .where('passTypeIdentifier', '==', passTypeIdentifier);

      if (passesUpdatedSince) {
        query.where('lastPassUpdate', '>', new Date(passesUpdatedSince));
      }

      const clientesSnapshot = await query.get();
      const serialNumbers = clientesSnapshot.docs.map(doc => doc.id);

      console.log('✅ Pases actualizados encontrados:', serialNumbers.length);
      res.status(200).json({ 
        serialNumbers,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error buscando actualizaciones:', error);
      res.status(500).send();
    }
  },

  getLatestPass: async (req: Request, res: Response) => {
    try {
      const { passTypeIdentifier, serialNumber } = req.params;
      
      console.log('📲 Solicitando pase actualizado:', {
        pass: passTypeIdentifier,
        serial: serialNumber
      });

      const clienteDoc = await db
        .collection('clientes')
        .doc(serialNumber)
        .get();

      if (!clienteDoc.exists) {
        console.log('❌ Cliente no encontrado');
        return res.status(404).send();
      }

      const clienteData = clienteDoc.data();
      const passUrl = await passService.generatePass({
        id: serialNumber,
        ...clienteData
      });

      console.log('✅ Pase actualizado generado:', passUrl);
      const passPath = await passService.getPassPath(passUrl.split('/').pop()!);
      res.sendFile(passPath);
    } catch (error) {
      console.error('❌ Error generando pase actualizado:', error);
      res.status(500).send();
    }
  },

  sendUpdateNotification: async (req: Request, res: Response) => {
    try {
      const { clienteId } = req.body;

      if (!clienteId) {
        return res.status(400).json({ error: 'ClienteId es requerido' });
      }

      console.log('🔄 Iniciando actualización para cliente:', clienteId);

      const clienteRef = db.collection('clientes').doc(clienteId);
      const clienteDoc = await clienteRef.get();

      if (!clienteDoc.exists) {
        throw new Error('Cliente no encontrado');
      }

      const clienteData = clienteDoc.data() as ClienteData;

      // Buscar registro del dispositivo si no hay token
      if (!clienteData.pushToken) {
        console.log('🔍 Buscando registro de dispositivo...');
        const registration = await deviceRegistrationService.getDeviceRegistration(clienteId);

        if (registration) {
          await clienteRef.update({
            pushToken: registration.pushToken,
            passTypeIdentifier: registration.passTypeIdentifier,
            lastPassUpdate: firestore.Timestamp.now()
          });
          
          clienteData.pushToken = registration.pushToken;
          clienteData.passTypeIdentifier = registration.passTypeIdentifier;
        }
      }

      if (!clienteData.pushToken) {
        throw new Error(`Cliente ${clienteId} no tiene token push registrado`);
      }

      // Enviar notificación
      await pushNotificationService.sendUpdateNotification(clienteId);
      
      console.log('✅ Notificación enviada exitosamente');
      res.status(200).json({ 
        message: 'Notificación enviada correctamente',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error enviando notificación:', error);
      res.status(500).json({ 
        error: 'Error al enviar notificación',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
};