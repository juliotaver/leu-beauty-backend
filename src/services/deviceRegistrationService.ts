import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import { DeviceRegistration } from '../types';

export class DeviceRegistrationService {
  private readonly COLLECTION_NAME = 'deviceRegistrations';

  async registerDevice(registration: Omit<DeviceRegistration, 'lastUpdated'>): Promise<void> {
    console.log('🔄 START registerDevice:', {
      deviceLibraryIdentifier: registration.deviceLibraryIdentifier,
      serialNumber: registration.serialNumber,
      token: registration.pushToken?.substring(0, 10) + '...'
    });

    try {
      const registrationId = `${registration.deviceLibraryIdentifier}-${registration.serialNumber}`;
      console.log('📝 Creating registration with ID:', registrationId);

      // Crear objeto de registro completo
      const registrationData: DeviceRegistration = {
        ...registration,
        lastUpdated: firestore.Timestamp.now()
      };

      // Guardar en deviceRegistrations
      console.log('💾 Saving to Firestore...');
      await db.collection(this.COLLECTION_NAME)
        .doc(registrationId)
        .set(registrationData, { merge: true });
      console.log('✅ Registro guardado en deviceRegistrations');

      // Log the document we just created
      const savedDoc = await db.collection(this.COLLECTION_NAME).doc(registrationId).get();
      console.log('📄 Saved document:', savedDoc.exists ? savedDoc.data() : 'Not found');

      // Actualizar el documento del cliente
      console.log('🔄 Actualizando cliente...');
      await db.collection('clientes')
        .doc(registration.serialNumber)
        .update({
          pushToken: registration.pushToken,
          deviceLibraryIdentifier: registration.deviceLibraryIdentifier,
          passTypeIdentifier: registration.passTypeIdentifier,
          lastUpdated: firestore.Timestamp.now()
        });

      console.log('✅ Cliente actualizado con información del dispositivo');
    } catch (error) {
      console.error('❌ Error en registerDevice:', error);
      if (error instanceof Error) {
        console.error('Detalles del error:', {
          message: error.message,
          stack: error.stack
        });
      }
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