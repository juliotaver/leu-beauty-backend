// src/services/pushNotificationService.ts
import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PushNotificationData {
  pushToken: string;
  passTypeIdentifier: string;
  deviceLibraryIdentifier?: string;
}

export class PushNotificationService {
  private certsDir: string;

  constructor() {
    this.certsDir = path.join(__dirname, '../../certificates');
  }

  async sendUpdateNotification(clienteId: string): Promise<void> {
    try {
      console.log('🔄 Iniciando actualización para cliente:', clienteId);

      // Obtener datos del cliente
      const clienteRef = db.collection('clientes').doc(clienteId);
      const clienteDoc = await clienteRef.get();

      if (!clienteDoc.exists) {
        console.error('❌ Cliente no encontrado:', clienteId);
        throw new Error('Cliente no encontrado');
      }

      const clienteData = clienteDoc.data() as PushNotificationData;
      console.log('📄 Datos del cliente:', JSON.stringify(clienteData, null, 2));

      // Si no hay pushToken en el cliente, buscar en deviceRegistrations
      if (!clienteData?.pushToken) {
        console.log('🔍 Buscando registro de dispositivo...');
        const registrationSnapshot = await db
          .collection('deviceRegistrations')
          .where('serialNumber', '==', clienteId)
          .limit(1)
          .get();

        if (!registrationSnapshot.empty) {
          const registration = registrationSnapshot.docs[0].data();
          console.log('✅ Registro de dispositivo encontrado:', registration);

          // Actualizar el cliente con la información del registro
          await clienteRef.update({
            pushToken: registration.pushToken,
            passTypeIdentifier: registration.passTypeIdentifier,
            deviceLibraryIdentifier: registration.deviceLibraryIdentifier,
            lastPassUpdate: firestore.Timestamp.now()
          });

          clienteData.pushToken = registration.pushToken;
          clienteData.passTypeIdentifier = registration.passTypeIdentifier;
        } else {
          console.log('❌ No se encontró registro de dispositivo para el cliente:', clienteId);
        }
      }

      if (!clienteData?.pushToken || !clienteData?.passTypeIdentifier) {
        throw new Error(`Cliente ${clienteId} no tiene token push o identificador de pase registrado`);
      }

      // Construir el comando curl para la notificación push
      const pushCommand = `curl -v -X POST \
        --cert "${path.join(this.certsDir, 'pass.pem')}" \
        --key "${path.join(this.certsDir, 'pass.key')}" \
        -H "apns-topic: ${clienteData.passTypeIdentifier}" \
        -H "apns-push-type: background" \
        -H "apns-priority: 5" \
        -H "Content-Type: application/json" \
        --data '{"aps":{"content-available":1}}' \
        "https://api.push.apple.com/3/device/${clienteData.pushToken}"`;

      console.log('🚀 Enviando notificación push...');
      console.log('Comando:', pushCommand);

      const { stdout, stderr } = await execAsync(pushCommand);

      if (stderr) {
        console.log('📝 Detalles de curl (stderr):', stderr);
      }

      if (stdout) {
        console.log('📝 Respuesta de APNs:', stdout);
      }

      // Actualizar timestamp de última actualización
      await clienteRef.update({
        lastPassUpdate: firestore.Timestamp.now()
      });

      console.log('✅ Notificación enviada exitosamente para cliente:', clienteId);
    } catch (error) {
      console.error('❌ Error en sendUpdateNotification:', error);
      
      // Log detallado del error
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      
      throw error;
    }
  }

  async unregisterDevice(deviceLibraryIdentifier: string): Promise<void> {
    try {
      console.log('🗑️ Eliminando registro de dispositivo:', deviceLibraryIdentifier);

      const deviceRef = db.collection('deviceRegistrations').doc(deviceLibraryIdentifier);
      const deviceDoc = await deviceRef.get();

      if (deviceDoc.exists) {
        const deviceData = deviceDoc.data();
        
        // Actualizar el cliente si existe
        if (deviceData?.serialNumber) {
          const clienteRef = db.collection('clientes').doc(deviceData.serialNumber);
          const clienteDoc = await clienteRef.get();

          if (clienteDoc.exists) {
            await clienteRef.update({
              pushToken: firestore.FieldValue.delete(),
              deviceLibraryIdentifier: firestore.FieldValue.delete(),
              passTypeIdentifier: firestore.FieldValue.delete()
            });
            console.log('✅ Información de dispositivo eliminada del cliente');
          }
        }

        // Eliminar el registro del dispositivo
        await deviceRef.delete();
        console.log('✅ Registro de dispositivo eliminado');
      } else {
        console.log('⚠️ No se encontró registro para el dispositivo:', deviceLibraryIdentifier);
      }
    } catch (error) {
      console.error('❌ Error en unregisterDevice:', error);
      throw error;
    }
  }
}

export const pushNotificationService = new PushNotificationService();