import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import { DeviceRegistration } from '../types';

export class DeviceRegistrationService {
  private readonly COLLECTION_NAME = 'deviceRegistrations';

  constructor() {
    console.log('🔥 Inicializando DeviceRegistrationService');
    this.verifyCollection().catch(error => {
      console.error('❌ Error en verificación inicial:', error);
    });
  }

  private async verifyCollection() {
    try {
      console.log('🔍 Verificando colección:', this.COLLECTION_NAME);
      const testDocRef = db.collection(this.COLLECTION_NAME).doc('_test_');
      
      // Intentar escribir
      await testDocRef.set({
        test: true,
        timestamp: firestore.Timestamp.now()
      });
      console.log('✅ Prueba de escritura exitosa');

      // Intentar leer
      const doc = await testDocRef.get();
      console.log('📖 Prueba de lectura:', doc.exists ? 'exitosa' : 'fallida');

      // Limpiar
      await testDocRef.delete();
      console.log('🧹 Prueba de eliminación exitosa');
    } catch (error) {
      console.error('❌ Error verificando colección:', error);
      throw error;
    }
  }

  async registerDevice(registration: Omit<DeviceRegistration, 'lastUpdated'>): Promise<void> {
    try {
      console.log('📝 DEBUG - Inicio de registro:', {
        registrationData: {
          ...registration,
          pushToken: registration.pushToken?.substring(0, 10) + '...'
        },
        timestamp: new Date().toISOString()
      });

      // Verificar la colección
      const testDoc = await db.collection(this.COLLECTION_NAME).get();
      console.log('📚 Estado de colección:', {
        empty: testDoc.empty,
        size: testDoc.size,
        exists: testDoc.docs.length > 0
      });

      const registrationId = `${registration.deviceLibraryIdentifier}-${registration.serialNumber}`;
      console.log('🔑 ID generado:', registrationId);

      // Crear documento con datos de debug
      const registrationData = {
        ...registration,
        lastUpdated: firestore.Timestamp.now(),
        _debug: {
          createdAt: firestore.Timestamp.now(),
          environment: process.env.NODE_ENV,
          registrationId,
          attempt: Date.now()
        }
      };

      // Intentar crear documento
      console.log('💾 Guardando documento...');
      const docRef = db.collection(this.COLLECTION_NAME).doc(registrationId);
      await docRef.set(registrationData);
      
      // Verificar inmediatamente
      const savedDoc = await docRef.get();
      if (savedDoc.exists) {
        console.log('✅ Documento guardado y verificado:', savedDoc.data());
      } else {
        throw new Error('Documento no se guardó correctamente');
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

      console.log('✅ Registro completado exitosamente');
    } catch (error) {
      console.error('❌ ERROR en registerDevice:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        collection: this.COLLECTION_NAME,
        registration: {
          ...registration,
          pushToken: '***REDACTED***'
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