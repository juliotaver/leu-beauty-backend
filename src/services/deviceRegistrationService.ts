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
      console.log('🗑️ Eliminando registro de dispositivo:', deviceLibraryIdentifier);
  
      // Primero verificar si existe el documento del cliente
      const clienteDoc = await db.collection('clientes').doc(serialNumber).get();
      
      if (clienteDoc.exists) {
        await clienteDoc.ref.update({
          pushToken: firestore.FieldValue.delete(),
          deviceLibraryIdentifier: firestore.FieldValue.delete(),
          passTypeIdentifier: firestore.FieldValue.delete()
        });
        console.log('✅ Información de dispositivo eliminada del cliente');
      } else {
        console.log('⚠️ Cliente no encontrado, continuando con eliminación del registro');
      }
  
      // Eliminar el registro del dispositivo si existe
      const deviceRef = db.collection('deviceRegistrations').doc(deviceLibraryIdentifier);
      const deviceDoc = await deviceRef.get();
  
      if (deviceDoc.exists) {
        await deviceRef.delete();
        console.log('✅ Registro de dispositivo eliminado');
      } else {
        console.log('⚠️ Registro de dispositivo no encontrado');
      }
    } catch (error) {
      console.error('❌ Error dando de baja dispositivo:', error);
      // No lanzar el error, solo loggearlo
      console.log('⚠️ Continuando a pesar del error');
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