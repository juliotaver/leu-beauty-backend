// src/controllers/passController.ts

import { Request, Response } from 'express';
import { passService } from '../services/passService';
import { pushNotificationService } from '../services/pushNotificationService';
import { deviceRegistrationService } from '../services/deviceRegistrationService';

export const passController = {
  async generatePass(req: Request, res: Response): Promise<Response | void> {
    try {
      const { clienteId, nombreCliente } = req.body;

      console.log('🚀 Generando pase para cliente:', { clienteId, nombreCliente });

      const passPath = await passService.generatePass(clienteId, nombreCliente);

      console.log('✅ Pase generado con éxito en ruta:', passPath);

      return res.status(200).json({ passPath });
    } catch (error) {
      console.error('❌ Error en la generación del pase:', error);
      return res.status(500).json({ error: 'Error interno en la generación del pase' });
    }
  },

  async getPassPath(req: Request, res: Response): Promise<Response | void> {
    try {
      const { passTypeIdentifier, serialNumber } = req.params;

      console.log('🔍 Obteniendo ruta para el pase:', { passTypeIdentifier, serialNumber });

      const passPath = await passService.getPassPath(passTypeIdentifier, serialNumber);

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

      const passPath = await passService.getPassPath(passTypeIdentifier, serialNumber);

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

      console.log('📱 Intento de registro de dispositivo:', {
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber,
        pushToken
      });

      await deviceRegistrationService.registerDevice({
        deviceLibraryIdentifier,
        pushToken,
        passTypeIdentifier,
        serialNumber
      });

      console.log('✅ Dispositivo registrado exitosamente');
      return res.status(201).send();
    } catch (error) {
      console.error('❌ Error en el registro de dispositivo:', error);
      return res.status(500).json({ error: 'Error registrando dispositivo' });
    }
  },

  async unregisterDevice(req: Request, res: Response): Promise<Response | void> {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;

      console.log('🗑️ Solicitud de baja de dispositivo:', {
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
      return res.status(200).send();
    } catch (error) {
      console.error('❌ Error dando de baja el dispositivo:', error);
      return res.status(500).json({ error: 'Error al dar de baja el dispositivo' });
    }
  },

  async getSerialNumbers(req: Request, res: Response): Promise<Response | void> {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
      const passesUpdatedSince = req.query.passesUpdatedSince as string;

      console.log('🔍 Obteniendo números de serie actualizados:', {
        deviceLibraryIdentifier,
        passTypeIdentifier,
        passesUpdatedSince
      });

      const serialNumbers = await deviceRegistrationService.getSerialNumbers(
        deviceLibraryIdentifier,
        passTypeIdentifier
      );

      console.log('✅ Números de serie encontrados:', serialNumbers);
      return res.status(200).json({ serialNumbers });
    } catch (error) {
      console.error('❌ Error obteniendo números de serie:', error);
      return res.status(500).json({ error: 'Error al obtener números de serie' });
    }
  }
};