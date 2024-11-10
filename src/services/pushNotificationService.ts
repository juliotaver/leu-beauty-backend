// src/services/pushNotificationService.ts
import { db } from '../config/firebase';
import * as apn from 'node-apn';
import path from 'path';

export class PushNotificationService {
  private apnProvider: apn.Provider;
  private certsDir: string;

  constructor() {
    this.certsDir = path.join(__dirname, '../../certificates');
    
    // Inicializar el proveedor de APN con los certificados
    this.apnProvider = new apn.Provider({
      cert: path.join(this.certsDir, 'pass.pem'),
      key: path.join(this.certsDir, 'pass.key'),
      production: process.env.NODE_ENV === 'production' // false para desarrollo
    });
  }

  async registerDevice(token: {
    pushToken: string;
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
    serialNumber: string;
  }): Promise<void> {
    try {
      // Registrar en Firestore
      const registrationRef = db.collection('deviceRegistrations').doc(token.deviceLibraryIdentifier);
      await registrationRef.set({
        ...token,
        timestamp: new Date(),
        lastUpdated: new Date()
      });

      // Actualizar el documento del cliente
      const clienteRef = db.collection('clientes').doc(token.serialNumber);
      await clienteRef.update({
        pushToken: token.pushToken,
        deviceLibraryIdentifier: token.deviceLibraryIdentifier,
        passTypeIdentifier: token.passTypeIdentifier
      });

      console.log(`Dispositivo registrado: ${token.deviceLibraryIdentifier}`);
    } catch (error) {
      console.error('Error registrando dispositivo:', error);
      throw error;
    }
  }

  async sendUpdateNotification(clienteId: string): Promise<void> {
    try {
      const clienteRef = db.collection('clientes').doc(clienteId);
      const clienteSnap = await clienteRef.get();

      if (!clienteSnap.exists) {
        throw new Error('Cliente no encontrado');
      }

      const clienteData = clienteSnap.data();
      if (!clienteData?.pushToken || !clienteData?.passTypeIdentifier) {
        console.log('No hay token de push o identificador de pase para el cliente:', clienteId);
        return;
      }

      // Crear notificación
      const notification = new apn.Notification();
      notification.pushType = 'background';
      notification.topic = clienteData.passTypeIdentifier;
      notification.payload = {
        aps: {
          'content-available': 1
        }
      };

      // Enviar notificación
      const result = await this.apnProvider.send(notification, clienteData.pushToken);
      console.log('Resultado de envío de notificación:', result);

      // Actualizar timestamp de última actualización
      await clienteRef.update({
        lastPassUpdate: new Date()
      });

      console.log('Notificación de actualización enviada para cliente:', clienteId);
    } catch (error) {
      console.error('Error enviando notificación de actualización:', error);
      throw error;
    }
  }

  async unregisterDevice(
    deviceLibraryIdentifier: string,
    passTypeIdentifier: string,
    serialNumber: string
  ): Promise<void> {
    try {
      // Eliminar registro del dispositivo
      await db.collection('deviceRegistrations')
        .doc(deviceLibraryIdentifier)
        .delete();

      // Actualizar documento del cliente
      const clienteRef = db.collection('clientes').doc(serialNumber);
      await clienteRef.update({
        pushToken: null,
        deviceLibraryIdentifier: null
      });

      console.log(`Dispositivo dado de baja: ${deviceLibraryIdentifier}`);
    } catch (error) {
      console.error('Error dando de baja dispositivo:', error);
      throw error;
    }
  }
}

export const pushNotificationService = new PushNotificationService();