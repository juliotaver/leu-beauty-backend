// src/services/deviceRegistrationService.ts
import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';

interface DeviceRegistration {
  deviceLibraryIdentifier: string;
  pushToken: string;
  passTypeIdentifier: string;
  serialNumber: string;  // Este es el ID del cliente
  lastUpdated: firestore.Timestamp;
}

export class DeviceRegistrationService {
  async registerDevice(registration: Omit<DeviceRegistration, 'lastUpdated'>): Promise<void> {
    try {
      console.log('Registrando dispositivo:', registration);

      // Guardar en deviceRegistrations
      await db.collection('deviceRegistrations').doc(registration.deviceLibraryIdentifier).set({
        ...registration,
        lastUpdated: firestore.Timestamp.now()
      });

      // Actualizar el documento del cliente con la información del dispositivo
      await db.collection('clientes').doc(registration.serialNumber).update({
        pushToken: registration.pushToken,
        deviceLibraryIdentifier: registration.deviceLibraryIdentifier,
        passTypeIdentifier: registration.passTypeIdentifier,
        lastUpdated: firestore.Timestamp.now()
      });

      console.log('Dispositivo registrado exitosamente');
    } catch (error) {
      console.error('Error registrando dispositivo:', error);
      throw error;
    }
  }

  async unregisterDevice(
    deviceLibraryIdentifier: string,
    passTypeIdentifier: string,
    serialNumber: string
  ): Promise<void> {
    try {
      // Eliminar registro de deviceRegistrations
      await db.collection('deviceRegistrations').doc(deviceLibraryIdentifier).delete();

      // Limpiar información del dispositivo en el cliente
      await db.collection('clientes').doc(serialNumber).update({
        pushToken: firestore.FieldValue.delete(),
        deviceLibraryIdentifier: firestore.FieldValue.delete(),
        passTypeIdentifier: firestore.FieldValue.delete()
      });

      console.log('Dispositivo dado de baja exitosamente');
    } catch (error) {
      console.error('Error dando de baja dispositivo:', error);
      throw error;
    }
  }

  async getDeviceRegistration(serialNumber: string): Promise<DeviceRegistration | null> {
    try {
      const registrations = await db
        .collection('deviceRegistrations')
        .where('serialNumber', '==', serialNumber)
        .limit(1)
        .get();

      if (registrations.empty) {
        return null;
      }

      return registrations.docs[0].data() as DeviceRegistration;
    } catch (error) {
      console.error('Error obteniendo registro de dispositivo:', error);
      throw error;
    }
  }
}

export const deviceRegistrationService = new DeviceRegistrationService();