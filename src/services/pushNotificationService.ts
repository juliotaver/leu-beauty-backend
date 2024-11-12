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

      // Buscar token en deviceRegistrations si no está en el cliente
      if (!clienteData?.pushToken || !clienteData?.passTypeIdentifier) {
        console.log('🔍 Token no encontrado en cliente, buscando en registros...');
        
        const registrationSnapshot = await db
          .collection('deviceRegistrations')
          .where('serialNumber', '==', clienteId)
          .orderBy('lastUpdated', 'desc')
          .limit(1)
          .get();

        if (!registrationSnapshot.empty) {
          const registration = registrationSnapshot.docs[0].data();
          console.log('✅ Registro encontrado:', registration);

          clienteData.pushToken = registration.pushToken;
          clienteData.passTypeIdentifier = registration.passTypeIdentifier;

          // Actualizar cliente con la información encontrada
          await clienteRef.update({
            pushToken: registration.pushToken,
            passTypeIdentifier: registration.passTypeIdentifier,
            deviceLibraryIdentifier: registration.deviceLibraryIdentifier,
            lastPassUpdate: firestore.Timestamp.now()
          });
        }
      }

      if (!clienteData?.pushToken || !clienteData?.passTypeIdentifier) {
        throw new Error(`Cliente ${clienteId} no tiene token push o identificador de pase registrado`);
      }

      // Construir el comando curl para APNs
      const pushCommand = `curl -v -X POST \
        --cert "${path.join(this.certsDir, 'pass.pem')}" \
        --key "${path.join(this.certsDir, 'pass.key')}" \
        -H "apns-topic: ${clienteData.passTypeIdentifier}" \
        -H "apns-push-type: background" \
        -H "apns-priority: 5" \
        -H "Content-Type: application/json" \
        --data '{"aps":{"content-available":1}}' \
        "${this.APNS_PRODUCTION_URL}${clienteData.pushToken}"`;

      console.log('🚀 Enviando notificación push...');
      console.log('📝 Comando:', pushCommand);

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

      console.log('✅ Notificación enviada exitosamente');
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
}

export const pushNotificationService = new PushNotificationService();