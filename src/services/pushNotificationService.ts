import { db } from '../config/firebase';
import fs from 'fs-extra';
import path from 'path';
import { PassService } from './passService';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PushToken {
  pushToken: string;
  deviceLibraryIdentifier: string;
  passTypeIdentifier: string;
  serialNumber: string;
}

export class PushNotificationService {
  private certsDir: string;

  constructor() {
    this.certsDir = path.join(__dirname, '../../certificates');
  }

  async registerDevice(token: PushToken): Promise<void> {
    const clienteRef = db.collection('clientes').doc(token.serialNumber);
    const clienteSnap = await clienteRef.get();

    if (!clienteSnap.exists) {
      throw new Error('Cliente no encontrado');
    }

    await clienteRef.update({
      pushToken: token.pushToken,
      deviceLibraryIdentifier: token.deviceLibraryIdentifier
    });
  }

  async sendUpdateNotification(clienteId: string): Promise<void> {
    const clienteRef = db.collection('clientes').doc(clienteId);
    const clienteSnap = await clienteRef.get();

    if (!clienteSnap.exists) {
      throw new Error('Cliente no encontrado');
    }

    const clienteData = clienteSnap.data();
    if (!clienteData?.pushToken) {
      console.log('No push token found for client:', clienteId);
      return;
    }

    try {
      // Generar un nuevo pase
      const passService = new PassService();
      await passService.generatePass({
        id: clienteId,
        ...clienteData
      });

      // Enviar notificación push a Apple
      const pushCommand = `curl -X POST \
        --cert "${path.join(this.certsDir, 'pass.pem')}" \
        --key "${path.join(this.certsDir, 'pass.key')}" \
        --header "Content-Type: application/json" \
        --data '{"pushToken": "${clienteData.pushToken}"}' \
        "https://api.push.apple.com/3/device/${clienteData.pushToken}"`;

      await execAsync(pushCommand);
      console.log('Push notification sent successfully for client:', clienteId);
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }
}