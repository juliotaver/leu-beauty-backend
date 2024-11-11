// src/services/pushNotificationService.ts
import { db } from '../config/firebase';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { firestore } from 'firebase-admin';

const execAsync = promisify(exec);

interface ClienteData {
  pushToken?: string;
  passTypeIdentifier?: string;
  deviceLibraryIdentifier?: string;
  lastPassUpdate?: firestore.Timestamp;
}

export class PushNotificationService {
  private certsDir: string;

  constructor() {
    this.certsDir = path.join(__dirname, '../../certificates');
  }

  async sendUpdateNotification(clienteId: string): Promise<void> {
    try {
      console.log('Iniciando actualización para cliente:', clienteId);

      const clienteDoc = await db.collection('clientes').doc(clienteId).get();
      
      if (!clienteDoc.exists) {
        throw new Error('Cliente no encontrado');
      }

      let clienteData = clienteDoc.data() as ClienteData;
      
      if (!clienteData.pushToken) {
        const registrationSnapshot = await db
          .collection('deviceRegistrations')
          .where('serialNumber', '==', clienteId)
          .limit(1)
          .get();

        if (!registrationSnapshot.empty) {
          const registration = registrationSnapshot.docs[0].data();
          clienteData = {
            ...clienteData,
            pushToken: registration.pushToken,
            passTypeIdentifier: registration.passTypeIdentifier
          };
        }
      }

      if (!clienteData.pushToken || !clienteData.passTypeIdentifier) {
        console.log('No se encontró pushToken o passTypeIdentifier para el cliente:', clienteId);
        return;
      }

      // URL correcta para APNs
      const pushCommand = `curl -v -X POST \
        --cert "${path.join(this.certsDir, 'pass.pem')}" \
        --key "${path.join(this.certsDir, 'pass.key')}" \
        -H "apns-topic: ${clienteData.passTypeIdentifier}" \
        -H "Content-Type: application/json" \
        --data '{"aps": {"content-available": 1}}' \
        "https://api.push.apple.com/3/device/${clienteData.pushToken}"`;

      console.log('Ejecutando comando push:', pushCommand);
      
      const { stdout, stderr } = await execAsync(pushCommand);
      
      if (stderr) {
        console.error('Error en curl:', stderr);
      }
      
      console.log('Respuesta de Apple:', stdout);

      // Actualizar timestamp de última actualización
      await db.collection('clientes').doc(clienteId).update({
        lastPassUpdate: firestore.Timestamp.now()
      });

      console.log('Notificación enviada exitosamente');
    } catch (error) {
      console.error('Error enviando notificación:', error);
      throw error;
    }
  }

  async unregisterDevice(
    deviceLibraryIdentifier: string,
    passTypeIdentifier: string,
    serialNumber: string
  ): Promise<void> {
    try {
      await db.collection('deviceRegistrations')
        .doc(deviceLibraryIdentifier)
        .delete();

      const clienteRef = db.collection('clientes').doc(serialNumber);
      const clienteDoc = await clienteRef.get();

      if (clienteDoc.exists) {
        const clienteData = clienteDoc.data() as ClienteData;
        if (clienteData?.deviceLibraryIdentifier === deviceLibraryIdentifier) {
          await clienteRef.update({
            pushToken: firestore.FieldValue.delete(),
            deviceLibraryIdentifier: firestore.FieldValue.delete(),
            passTypeIdentifier: firestore.FieldValue.delete()
          });
        }
      }

      console.log('Dispositivo dado de baja exitosamente');
    } catch (error) {
      console.error('Error dando de baja dispositivo:', error);
      throw error;
    }
  }
}

export const pushNotificationService = new PushNotificationService();