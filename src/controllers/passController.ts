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

export const passController = {
  // Método para generar el pase
  generatePass: async (req: Request, res: Response) => {
    try {
      console.log('Generando pase para:', req.body);
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

      console.log('📱 Registrando dispositivo:', {
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber,
        pushToken,
        headers: req.headers
      });

      // Verificar que el cliente existe
      const clienteRef = db.collection('clientes').doc(serialNumber);
      const clienteDoc = await clienteRef.get();

      if (!clienteDoc.exists) {
        console.error('❌ Cliente no encontrado:', serialNumber);
        return res.status(404).send();
      }

      // Registrar el dispositivo usando el servicio
      await deviceRegistrationService.registerDevice({
        deviceLibraryIdentifier,
        pushToken,
        passTypeIdentifier,
        serialNumber
      });

      console.log('✅ Dispositivo registrado exitosamente');
      res.status(201).send();
    } catch (error) {
      console.error('❌ Error en registerDevice:', error);
      res.status(500).send();
    }
  },

  // Método para anular el registro del dispositivo
  unregisterDevice: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;

      console.log('🗑️ Dando de baja dispositivo:', {
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber
      });

      await deviceRegistrationService.unregisterDevice(
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber
      );

      console.log('✅ Dispositivo dado de baja exitosamente');
      res.status(200).send();
    } catch (error) {
      console.error('❌ Error unregistering device:', error);
      res.status(500).send();
    }
  },

  // Obtener serial numbers de los pases actualizados
  getSerialNumbers: async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
      const { passesUpdatedSince } = req.query;

      console.log('🔍 Buscando pases actualizados:', {
        deviceLibraryIdentifier,
        passTypeIdentifier,
        passesUpdatedSince
      });

      // Verificar que el dispositivo está registrado
      const registration = await deviceRegistrationService.getDeviceRegistration(deviceLibraryIdentifier);
      
      if (!registration) {
        console.log('❌ Dispositivo no encontrado:', deviceLibraryIdentifier);
        return res.status(404).send();
      }

      // Buscar pases actualizados
      const clientesSnapshot = await db
        .collection('clientes')
        .where('passTypeIdentifier', '==', passTypeIdentifier)
        .where('lastPassUpdate', '>', new Date(passesUpdatedSince as string))
        .get();

      const serialNumbers = clientesSnapshot.docs.map(doc => doc.id);

      console.log('✅ Números de serie encontrados:', serialNumbers);
      res.status(200).json({ 
        serialNumbers,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error getting serial numbers:', error);
      res.status(500).send();
    }
  },

  // Obtener el pase actualizado más reciente
  getLatestPass: async (req: Request, res: Response) => {
    try {
      const { passTypeIdentifier, serialNumber } = req.params;
      
      console.log('📲 Obteniendo última versión del pase:', {
        passTypeIdentifier,
        serialNumber
      });

      const clienteSnapshot = await db
        .collection('clientes')
        .doc(serialNumber)
        .get();

      if (!clienteSnapshot.exists) {
        console.log('❌ Cliente no encontrado:', serialNumber);
        return res.status(404).send();
      }

      const clienteData = clienteSnapshot.data();
      
      // Generar pase actualizado
      const passUrl = await passService.generatePass({
        id: serialNumber,
        ...clienteData
      });

      console.log('✅ Pase actualizado generado:', passUrl);
      
      // Enviar el archivo .pkpass
      const passPath = await passService.getPassPath(passUrl.split('/').pop()!);
      res.sendFile(passPath);
    } catch (error) {
      console.error('❌ Error getting latest pass:', error);
      res.status(500).send();
    }
  },

  // Método para enviar notificación de actualización
  sendUpdateNotification: async (clienteId: string): Promise<void> => {
    try {
      console.log('🔄 Iniciando actualización para cliente:', clienteId);

      const clienteRef = db.collection('clientes').doc(clienteId);
      const clienteDoc = await clienteRef.get();

      if (!clienteDoc.exists) {
        throw new Error('Cliente no encontrado');
      }

      const clienteData = clienteDoc.data() as ClienteData;
      
      // Si no hay pushToken en el cliente, buscar en registros de dispositivos
      if (!clienteData.pushToken) {
        console.log('🔍 Buscando registro de dispositivo para cliente:', clienteId);
        const registration = await deviceRegistrationService.getDeviceRegistration(clienteId);

        if (registration) {
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

      // Enviar notificación
      await pushNotificationService.sendUpdateNotification(clienteId);
      console.log('✅ Notificación enviada exitosamente');

    } catch (error) {
      console.error('❌ Error en sendUpdateNotification:', error);
      throw error;
    }
  },

  // Manejar notificación de actualización desde la solicitud HTTP
  handleUpdateNotification: async (req: Request, res: Response) => {
    const { clienteId } = req.body;

    if (!clienteId) {
      return res.status(400).json({ error: 'ClienteId es requerido' });
    }

    try {
      await passController.sendUpdateNotification(clienteId);
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