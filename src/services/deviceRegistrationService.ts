import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import { DeviceRegistration } from '../types';

export class DeviceRegistrationService {
  private readonly COLLECTION_NAME = 'deviceRegistrations';

  async registerDevice(registration: Omit<DeviceRegistration, 'lastUpdated'>): Promise<void> {
    console.log('🔍 DEBUG - Iniciando registro de dispositivo:', {
      registrationData: {
        ...registration,
        pushToken: registration.pushToken?.substring(0, 10) + '...'
      },
      timestamp: new Date().toISOString()
    });

    try {
      const registrationId = `${registration.deviceLibraryIdentifier}-${registration.serialNumber}`;
      console.log('🔑 ID de registro generado:', registrationId);

      // Verificar que la colección existe
      const collectionRef = db.collection(this.COLLECTION_NAME);
      console.log('📁 Referencia a colección creada:', this.COLLECTION_NAME);

      const registrationData: DeviceRegistration = {
        ...registration,
        lastUpdated: firestore.Timestamp.now()
      };

      // Intentar crear/actualizar el documento
      console.log('💾 Intentando guardar documento...');
      await collectionRef.doc(registrationId).set(registrationData, { merge: true });
      console.log('✅ Documento guardado exitosamente');

      // Actualizar cliente
      console.log('🔄 Actualizando cliente...');
      await db.collection('clientes')
        .doc(registration.serialNumber)
        .update({
          pushToken: registration.pushToken,
          deviceLibraryIdentifier: registration.deviceLibraryIdentifier,
          passTypeIdentifier: registration.passTypeIdentifier,
          lastUpdated: firestore.Timestamp.now()
        });
      console.log('✅ Cliente actualizado exitosamente');
    } catch (error) {
      console.error('❌ ERROR en registerDevice:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        registration: {
          ...registration,
          pushToken: registration.pushToken?.substring(0, 10) + '...'
        }
      });
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

      const registrationId = `${deviceLibraryIdentifier}-${serialNumber}`;
      await db.collection(this.COLLECTION_NAME)
        .doc(registrationId)
        .delete();

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