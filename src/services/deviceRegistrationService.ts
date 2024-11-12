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
  private readonly COLLECTION_NAME = 'deviceRegistrations';

  async registerDevice(registration: Omit<DeviceRegistration, 'lastUpdated'>): Promise<void> {
    try {
      console.log('📱 Registrando dispositivo:', registration);

      // Crear un ID único para el registro que combine dispositivo y serialNumber
      const registrationId = `${registration.deviceLibraryIdentifier}-${registration.serialNumber}`;

      // Crear objeto de registro completo
      const registrationData: DeviceRegistration = {
        ...registration,
        lastUpdated: firestore.Timestamp.now()
      };

      // Guardar en deviceRegistrations
      await db.collection(this.COLLECTION_NAME)
        .doc(registrationId)
        .set(registrationData, { merge: true });

      // Actualizar el documento del cliente
      await db.collection('clientes')
        .doc(registration.serialNumber)
        .update({
          pushToken: registration.pushToken,
          deviceLibraryIdentifier: registration.deviceLibraryIdentifier,
          passTypeIdentifier: registration.passTypeIdentifier,
          lastUpdated: firestore.Timestamp.now()
        });

      console.log('✅ Dispositivo registrado exitosamente:', registrationId);
    } catch (error) {
      console.error('❌ Error registrando dispositivo:', error);
      throw error;
    }
  }

  async unregisterDevice(
    deviceLibraryIdentifier: string,
    passTypeIdentifier: string,
    serialNumber: string
  ): Promise<void> {
    try {
      console.log('🗑️ Eliminando registro de dispositivo:', {
        device: deviceLibraryIdentifier,
        pass: passTypeIdentifier,
        serial: serialNumber
      });

      // Eliminar registro de deviceRegistrations
      const registrationId = `${deviceLibraryIdentifier}-${serialNumber}`;
      await db.collection(this.COLLECTION_NAME)
        .doc(registrationId)
        .delete();

      // Actualizar cliente
      await db.collection('clientes')
        .doc(serialNumber)
        .update({
          pushToken: firestore.FieldValue.delete(),
          deviceLibraryIdentifier: firestore.FieldValue.delete(),
          passTypeIdentifier: firestore.FieldValue.delete(),
          lastUpdated: firestore.Timestamp.now()
        });

      console.log('✅ Dispositivo dado de baja exitosamente');
    } catch (error) {
      console.error('❌ Error dando de baja dispositivo:', error);
      throw error;
    }
  }

  async getDeviceRegistration(serialNumber: string): Promise<DeviceRegistration | null> {
    try {
      console.log('🔍 Buscando registros para cliente:', serialNumber);

      const registrations = await db.collection(this.COLLECTION_NAME)
        .where('serialNumber', '==', serialNumber)
        .orderBy('lastUpdated', 'desc')
        .limit(1)
        .get();

      if (!registrations.empty) {
        const registration = registrations.docs[0].data() as DeviceRegistration;
        console.log('✅ Registro encontrado:', registration);
        return registration;
      }

      console.log('⚠️ No se encontró registro para el cliente:', serialNumber);
      return null;
    } catch (error) {
      console.error('❌ Error buscando registro:', error);
      throw error;
    }
  }

  async getAllRegistrationsForPass(passTypeIdentifier: string): Promise<DeviceRegistration[]> {
    try {
      console.log('🔍 Buscando todos los registros para pass:', passTypeIdentifier);

      const registrations = await db.collection(this.COLLECTION_NAME)
        .where('passTypeIdentifier', '==', passTypeIdentifier)
        .get();

      const result = registrations.docs.map(doc => doc.data() as DeviceRegistration);
      console.log(`✅ Encontrados ${result.length} registros`);
      
      return result;
    } catch (error) {
      console.error('❌ Error buscando registros:', error);
      throw error;
    }
  }
}

export const deviceRegistrationService = new DeviceRegistrationService();