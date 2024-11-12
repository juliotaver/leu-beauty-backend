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

interface DeviceRegistration {
  pushToken: string;
  passTypeIdentifier: string;
  deviceLibraryIdentifier: string;
  serialNumber: string;
  lastUpdated: firestore.Timestamp;
}

export class PushNotificationService {
  private readonly certsDir: string;
  private readonly APNS_PRODUCTION_URL = 'https://api.push.apple.com/3/device/';
  private readonly APNS_DEVELOPMENT_URL = 'https://api.development.push.apple.com/3/device/';

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

      // Si no hay pushToken o passTypeIdentifier en el cliente, buscar en registros
      if (!clienteData?.pushToken || !clienteData?.passTypeIdentifier) {
        console.log('🔍 Token no encontrado en cliente, buscando en registros...');
        
        // Buscar el registro más reciente para este cliente
        const registrationId = `${clienteData.deviceLibraryIdentifier}-${clienteId}`;
        const registrationDoc = await db.collection('deviceRegistrations').doc(registrationId).get();

        if (registrationDoc.exists) {
          const registration = registrationDoc.data() as DeviceRegistration;
          console.log('✅ Registro encontrado:', registration);

          // Actualizar datos del cliente con la información del registro
          await clienteRef.update({
            pushToken: registration.pushToken,
            passTypeIdentifier: registration.passTypeIdentifier,
            deviceLibraryIdentifier: registration.deviceLibraryIdentifier,
            lastPassUpdate: firestore.Timestamp.now()
          });

          clienteData.pushToken = registration.pushToken;
          clienteData.passTypeIdentifier = registration.passTypeIdentifier;
        } else {
          // Intento de búsqueda alternativa si no se encuentra por ID compuesto
          const registrationSnapshot = await db.collection('deviceRegistrations')
            .where('serialNumber', '==', clienteId)
            .limit(1)
            .get();

          if (!registrationSnapshot.empty) {
            const registration = registrationSnapshot.docs[0].data() as DeviceRegistration;
            console.log('✅ Registro encontrado por serialNumber:', registration);

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
      }

      if (!clienteData?.pushToken || !clienteData?.passTypeIdentifier) {
        throw new Error(`Cliente ${clienteId} no tiene token push o identificador de pase registrado`);
      }

      // Construir y ejecutar el comando curl para APNs
      const pushCommand = `curl -v -X POST \
        --cert "${path.join(this.certsDir, 'pass.pem')}" \
        --key "${path.join(this.certsDir, 'pass.key')}" \
        -H "apns-topic: ${clienteData.passTypeIdentifier}" \
        -H "apns-push-type: background" \
        -H "apns-priority: 5" \
        -H "Content-Type: application/json" \
        --data '{"aps":{"content-available":1}}' \
        "${this.APNS_PRODUCTION_URL}${clienteData.pushToken}"`;

      console.log('🚀 Enviando notificación push...', {
        passTypeIdentifier: clienteData.passTypeIdentifier,
        pushToken: clienteData.pushToken.substring(0, 10) + '...'
      });

      const { stdout, stderr } = await execAsync(pushCommand);

      if (stderr) {
        console.log('📝 Respuesta de curl (stderr):', stderr);
      }

      if (stdout) {
        console.log('📝 Respuesta de APNs:', stdout);
      }

      // Actualizar timestamp de última actualización
      await clienteRef.update({
        lastPassUpdate: firestore.Timestamp.now()
      });

      console.log('✅ Actualización completada exitosamente');
    } catch (error) {
      console.error('❌ Error en sendUpdateNotification:', error);
      
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      
      throw error;
    }
  }

  async sendPushToAllDevices(passTypeIdentifier: string): Promise<void> {
    try {
      console.log('🔄 Enviando actualización a todos los dispositivos registrados');

      const registrations = await db.collection('deviceRegistrations')
        .where('passTypeIdentifier', '==', passTypeIdentifier)
        .get();

      if (registrations.empty) {
        console.log('⚠️ No se encontraron dispositivos registrados');
        return;
      }

      const pushPromises = registrations.docs.map(async (doc) => {
        const registration = doc.data() as DeviceRegistration;
        try {
          await this.sendUpdateNotification(registration.serialNumber);
          console.log(`✅ Notificación enviada para: ${registration.serialNumber}`);
        } catch (error) {
          console.error(`❌ Error enviando notificación a ${registration.serialNumber}:`, error);
        }
      });

      await Promise.all(pushPromises);
      console.log('✅ Proceso de actualización masiva completado');
    } catch (error) {
      console.error('❌ Error en sendPushToAllDevices:', error);
      throw error;
    }
  }
}

export const pushNotificationService = new PushNotificationService();