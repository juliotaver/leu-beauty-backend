import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import { DeviceRegistration } from '../types';

export class DeviceRegistrationService {
  private readonly COLLECTION_NAME = 'deviceRegistrations';

  // En deviceRegistrationService.ts, modificar el método registerDevice
async registerDevice(registration: Omit<DeviceRegistration, 'lastUpdated'>): Promise<void> {
  try {
    console.log('🔄 START registerDevice:', {
      deviceId: registration.deviceLibraryIdentifier,
      serialNumber: registration.serialNumber,
      token: registration.pushToken?.substring(0, 10) + '...'
    });

    // Verificar que la colección existe
    const collectionRef = db.collection(this.COLLECTION_NAME);
    console.log('📁 Colección a usar:', this.COLLECTION_NAME);

    const registrationId = `${registration.deviceLibraryIdentifier}-${registration.serialNumber}`;
    console.log('🔑 ID de registro generado:', registrationId);

    // Intentar crear la colección si no existe
    try {
      const testDoc = await collectionRef.doc('test').get();
      if (!testDoc.exists) {
        await collectionRef.doc('test').set({ test: true });
        await collectionRef.doc('test').delete();
      }
    } catch (error) {
      console.error('⚠️ Error verificando colección:', error);
    }

    // Crear el documento
    const registrationData = {
      ...registration,
      lastUpdated: firestore.Timestamp.now()
    };

    console.log('💾 Intentando guardar documento...');
    await collectionRef.doc(registrationId).set(registrationData);
    console.log('✅ Documento guardado exitosamente');

    // Verificar que se guardó
    const savedDoc = await collectionRef.doc(registrationId).get();
    console.log('📄 Documento guardado:', savedDoc.exists ? savedDoc.data() : 'No encontrado');

    // Actualizar cliente
    console.log('🔄 Actualizando cliente...');
    await db.collection('clientes').doc(registration.serialNumber).update({
      pushToken: registration.pushToken,
      deviceLibraryIdentifier: registration.deviceLibraryIdentifier,
      passTypeIdentifier: registration.passTypeIdentifier,
      lastUpdated: firestore.Timestamp.now()
    });

    console.log('✅ Registro completado exitosamente');
  } catch (error) {
    console.error('❌ ERROR en registerDevice:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
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