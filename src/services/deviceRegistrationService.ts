import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import { DeviceRegistration } from '../types';

export class DeviceRegistrationService {
  private readonly COLLECTION_NAME = 'deviceRegistrations';

  constructor() {
    console.log('🔥 Inicializando DeviceRegistrationService');
    // Test de conexión al iniciar
    this.testConnection();
  }

  private async testConnection() {
    try {
      console.log('🔄 Probando conexión a Firestore...');
      await db.collection(this.COLLECTION_NAME).doc('_test_').set({
        test: true,
        timestamp: firestore.Timestamp.now()
      });
      console.log('✅ Conexión a Firestore exitosa');
      await db.collection(this.COLLECTION_NAME).doc('_test_').delete();
    } catch (error) {
      console.error('❌ Error conectando a Firestore:', error);
    }
  }

  async registerDevice(registration: Omit<DeviceRegistration, 'lastUpdated'>): Promise<void> {
    try {
      console.log('🔄 START registerDevice:', {
        deviceId: registration.deviceLibraryIdentifier,
        serialNumber: registration.serialNumber,
        token: registration.pushToken?.substring(0, 10) + '...'
      });

      // Test de escritura
      const registrationId = `${registration.deviceLibraryIdentifier}-${registration.serialNumber}`;
      console.log('📝 Intentando escribir documento:', registrationId);

      const registrationData = {
        ...registration,
        lastUpdated: firestore.Timestamp.now(),
        _debug: {
          timestamp: firestore.Timestamp.now(),
          attemptId: Math.random().toString(36).substring(7)
        }
      };

      // Intentar guardar
      await db.collection(this.COLLECTION_NAME)
        .doc(registrationId)
        .set(registrationData, { merge: true });

      console.log('✅ Documento guardado exitosamente');

      // Verificar que se guardó
      const savedDoc = await db.collection(this.COLLECTION_NAME)
        .doc(registrationId)
        .get();

      if (savedDoc.exists) {
        console.log('📄 Documento verificado:', savedDoc.data());
      } else {
        console.error('❌ Documento no se guardó correctamente');
        throw new Error('Document not saved');
      }

      // Actualizar cliente
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
      console.error('❌ Error en registerDevice:', error);
      // Log más detallado del error
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          registration: {
            ...registration,
            pushToken: '***redacted***'
          }
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