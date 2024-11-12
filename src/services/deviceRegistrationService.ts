// deviceRegistrationService.ts

import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import { DeviceRegistration } from '../types';

export class DeviceRegistrationService {
  private readonly COLLECTION_NAME = 'deviceRegistrations';

  constructor() {
    console.log('🔥 Inicializando DeviceRegistrationService');
    this.verifyCollection().catch(error => {
      console.error('❌ Error en verificación inicial de Firestore:', error);
    });
  }

  private async verifyCollection() {
    try {
      console.log('🔍 Verificando acceso a Firestore para la colección:', this.COLLECTION_NAME);
      const testDocRef = db.collection(this.COLLECTION_NAME).doc('_test_');
      
      await testDocRef.set({
        test: true,
        timestamp: firestore.Timestamp.now()
      });
      console.log('✅ Prueba de escritura en Firestore exitosa');
      
      const doc = await testDocRef.get();
      console.log('📖 Prueba de lectura:', doc.exists ? 'exitosa' : 'fallida');
      
      await testDocRef.delete();
      console.log('🧹 Prueba de eliminación de Firestore exitosa');
    } catch (error) {
      console.error('❌ Error al verificar la colección en Firestore:', error);
      throw error;
    }
  }

  async registerDevice(registration: Omit<DeviceRegistration, 'lastUpdated'>): Promise<void> {
    try {
      console.log('📝 DEBUG - Inicio de registro de dispositivo:', {
        registrationData: {
          ...registration,
          pushToken: registration.pushToken?.substring(0, 10) + '...'
        },
        timestamp: new Date().toISOString()
      });

      const testDoc = await db.collection(this.COLLECTION_NAME).get();
      console.log('📚 Estado de colección:', {
        empty: testDoc.empty,
        size: testDoc.size,
        exists: testDoc.docs.length > 0
      });

      const registrationId = `${registration.deviceLibraryIdentifier}-${registration.serialNumber}`;
      console.log('🔑 ID generado para el registro:', registrationId);

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

      console.log('💾 Intentando guardar el documento de registro...');
      const docRef = db.collection(this.COLLECTION_NAME).doc(registrationId);
      await docRef.set(registrationData, { merge: true });
      
      const savedDoc = await docRef.get();
      if (savedDoc.exists) {
        console.log('✅ Documento de registro guardado y verificado:', savedDoc.data());
      } else {
        throw new Error('Error: El documento no se guardó correctamente en Firestore');
      }

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

      console.log('✅ Dispositivo eliminado exitosamente');
    } catch (error) {
      console.error('❌ Error eliminando dispositivo de Firestore:', error);
      throw error;
    }
  }

  async getDeviceRegistration(serialNumber: string): Promise<DeviceRegistration | null> {
    try {
      console.log('🔍 Buscando registros para el cliente:', serialNumber);

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
      console.error('❌ Error buscando registro en Firestore:', error);
      throw error;
    }
  }

  async getAllRegistrationsForPass(passTypeIdentifier: string): Promise<DeviceRegistration[]> {
    try {
      console.log('🔍 Buscando todos los registros para el pass:', passTypeIdentifier);

      const registrations = await db.collection(this.COLLECTION_NAME)
        .where('passTypeIdentifier', '==', passTypeIdentifier)
        .get();

      const result = registrations.docs.map(doc => doc.data() as DeviceRegistration);
      console.log(`✅ Encontrados ${result.length} registros en Firestore`);
      
      return result;
    } catch (error) {
      console.error('❌ Error buscando registros en Firestore:', error);
      throw error;
    }
  }
}

export const deviceRegistrationService = new DeviceRegistrationService();