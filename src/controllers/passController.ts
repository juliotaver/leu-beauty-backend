// src/controllers/passController.ts

import { Request, Response } from 'express';
import { passService } from '../services/passService';
import { pushNotificationService } from '../services/pushNotificationService';
import { deviceRegistrationService } from '../services/deviceRegistrationService';
import { db } from '../config/firebase'; // Asegúrate de tener esta línea para importar `db`

export const passController = {
  async generatePass(req: Request, res: Response): Promise<Response | void> {
    try {
      const { id, nombre } = req.body;

      console.log('🚀 Generando pase para cliente:', { id, nombre });

      const passUrl = await passService.generatePass(req.body);

      console.log('✅ Pase generado con éxito en URL:', `${process.env.API_BASE_URL}${passUrl}`);

      return res.status(200).json({ passUrl: `${process.env.API_BASE_URL}${passUrl}` });
    } catch (error) {
      console.error('❌ Error en la generación del pase:', error);
      return res.status(500).json({ error: 'Error interno en la generación del pase' });
    }
  },

  async getPassPath(req: Request, res: Response): Promise<Response | void> {
    try {
      const { passTypeIdentifier, serialNumber } = req.params;

      console.log('🔍 Obteniendo ruta para el pase:', { passTypeIdentifier, serialNumber });

      const passPath = await passService.getPassPath(`${passTypeIdentifier}-${serialNumber}`);
      
      if (passPath) {
        console.log('✅ Ruta del pase encontrada:', passPath);
        return res.status(200).sendFile(passPath);
      } else {
        console.warn('⚠️ Pase no encontrado:', { passTypeIdentifier, serialNumber });
        return res.status(404).json({ error: 'Pase no encontrado' });
      }
    } catch (error) {
      console.error('❌ Error obteniendo la ruta del pase:', error);
      return res.status(500).json({ error: 'Error interno obteniendo la ruta del pase' });
    }
  },

  async sendUpdateNotification(req: Request, res: Response): Promise<Response | void> {
    try {
      const { clienteId } = req.body;

      if (!clienteId) {
        return res.status(400).json({ error: 'ClienteId es requerido' });
      }

      console.log('🔄 Iniciando actualización para cliente:', clienteId);

      await pushNotificationService.sendUpdateNotification(clienteId);

      console.log('✅ Notificación de actualización enviada exitosamente');
      return res.status(200).json({ message: 'Notificación enviada correctamente' });
    } catch (error) {
      console.error('❌ Error al enviar notificación de actualización:', error);
      return res.status(500).json({ error: 'Error al enviar notificación de actualización' });
    }
  },

  async getLatestPass(req: Request, res: Response): Promise<Response | void> {
    try {
      const { passTypeIdentifier, serialNumber } = req.params;

      console.log('📲 Solicitando pase actualizado:', { passTypeIdentifier, serialNumber });

      const passPath = await passService.getPassPath(`${passTypeIdentifier}-${serialNumber}`);

      if (passPath) {
        console.log('✅ Pase actualizado encontrado en ruta:', passPath);
        return res.status(200).sendFile(passPath);
      } else {
        console.warn('⚠️ Pase no encontrado para actualización:', { passTypeIdentifier, serialNumber });
        return res.status(404).json({ error: 'Pase no encontrado para actualización' });
      }
    } catch (error) {
      console.error('❌ Error al obtener pase actualizado:', error);
      return res.status(500).json({ error: 'Error interno al obtener pase actualizado' });
    }
  },

  async registerDevice(req: Request, res: Response): Promise<Response | void> {
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

      const clienteRef = db.collection('clientes').doc(serialNumber);
      const clienteDoc = await clienteRef.get();

      if (!clienteDoc.exists) {
        console.error('❌ Cliente no encontrado:', serialNumber);
        return res.status(404).send();
      }

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

  async unregisterDevice(req: Request, res: Response): Promise<Response | void> {
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

  async getSerialNumbers(req: Request, res: Response): Promise<Response | void> {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
      const passesUpdatedSince = req.query.passesUpdatedSince as string;

      console.log('🔍 Buscando actualizaciones:', {
        device: deviceLibraryIdentifier,
        pass: passTypeIdentifier,
        since: passesUpdatedSince
      });

      const registration = await deviceRegistrationService.getDeviceRegistration(deviceLibraryIdentifier);

      if (!registration) {
        console.log('❌ Dispositivo no registrado');
        return res.status(404).send();
      }

      const query = db.collection('clientes')
        .where('passTypeIdentifier', '==', passTypeIdentifier);

      if (passesUpdatedSince) {
        query.where('lastPassUpdate', '>', new Date(passesUpdatedSince));
      }

      const clientesSnapshot = await query.get();
      const serialNumbers = clientesSnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.id);

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
};