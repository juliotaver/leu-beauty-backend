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
  nombre: string;
  email: string;
  visitas: number;
  ultimaVisita: firestore.Timestamp;
  fechaRegistro: firestore.Timestamp;
  recompensasCanjeadas: string[];
  proximaRecompensa?: string;
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

          await db.collection('clientes').doc(clienteId).update({
            pushToken: registration.pushToken,
            passTypeIdentifier: registration.passTypeIdentifier
          });
        }
      }

      if (!clienteData.pushToken) {
        console.log('No se encontró pushToken para el cliente:', clienteId);
        return;
      }

      const pushCommand = `curl -X POST \
        --cert "${path.join(this.certsDir, 'pass.pem')}" \
        --key "${path.join(this.certsDir, 'pass.key')}" \
        -H "Content-Type: application/json" \
        -d '{"pushToken": "${clienteData.pushToken}"}' \
        "https://api.push.apple.com/v1/pushPackages/${clienteData.passTypeIdentifier || 'pass.com.salondenails.loyalty'}"`;

      console.log('Ejecutando comando push:', pushCommand);
      
      const { stdout, stderr } = await execAsync(pushCommand);
      
      if (stderr) {
        console.error('Error en curl:', stderr);
      }
      
      console.log('Respuesta de Apple:', stdout);

      await db.collection('clientes').doc(clienteId).update({
        lastPassUpdate: new Date()
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
      console.log('Dando de baja dispositivo:', {
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber
      });

      // Eliminar el registro del dispositivo
      const deviceRegistrationRef = db
        .collection('deviceRegistrations')
        .doc(deviceLibraryIdentifier);

      await deviceRegistrationRef.delete();

      // Actualizar el documento del cliente
      const clienteRef = db.collection('clientes').doc(serialNumber);
      const clienteDoc = await clienteRef.get();

      if (clienteDoc.exists) {
        const clienteData = clienteDoc.data();
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