// src/services/passService.ts

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class PassService {
  private passesDir: string;

  constructor() {
    this.passesDir = path.join(__dirname, '../../public/passes');
    fs.ensureDirSync(this.passesDir); // Asegura que el directorio para los pases exista
  }

  // Método para generar el pase
  async generatePass(cliente: any): Promise<string> {
    const passId = `${Date.now()}-${cliente.id}`;
    const passDir = path.join(this.passesDir, passId);

    try {
      await fs.ensureDir(passDir);
      const passData = this.createPassData(cliente);

      // Guardar datos del pase
      await fs.writeJson(path.join(passDir, 'pass.json'), passData, { spaces: 2 });

      // Copiar imágenes y crear el manifiesto
      await this.copyImages(passDir);
      const manifest = await this.createManifest(passDir);
      await fs.writeJson(path.join(passDir, 'manifest.json'), manifest, { spaces: 2 });

      // Firmar y crear el archivo .pkpass
      const signature = await this.signManifest(manifest, passDir);
      const pkpassPath = await this.createPkpass(passDir, signature, passId);

      await fs.remove(passDir); // Limpiar el directorio temporal
      return `/passes/${passId}.pkpass`;
    } catch (error) {
      console.error('Error en generatePass:', error);
      await fs.remove(passDir);
      throw error;
    }
  }

  // Método para obtener la ruta del pase generado
  async getPassPath(passId: string): Promise<string> {
    const passPath = path.join(this.passesDir, `${passId}.pkpass`);
    if (await fs.pathExists(passPath)) {
      return passPath;
    }
    throw new Error('Pase no encontrado');
  }

  // Helper: Crear datos del pase
  private createPassData(cliente: any) {
    return {
      formatVersion: 1,
      passTypeIdentifier: "pass.com.salondenails.loyalty",
      serialNumber: cliente.id,
      teamIdentifier: "C8PM27PK3X",
      authenticationToken: cliente.id,
      organizationName: "Leu Beauty",
      description: `Tarjeta de Fidelidad - ${cliente.nombre}`,
      foregroundColor: "rgb(239, 233, 221)",
      backgroundColor: "rgb(132, 149, 105)",
      labelColor: "rgb(239, 233, 221)",
      storeCard: {
        headerFields: [{ key: "nombre", label: "NOMBRE", value: cliente.nombre }],
        secondaryFields: [{ key: "visits", label: "VISITAS", value: `${cliente.visitas}/5` }],
        backFields: [{ key: "rewards", label: "Programa de Recompensas", value: "..." }]
      },
      barcode: { message: cliente.id, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" }
    };
  }

  // Helper: Copiar imágenes necesarias al directorio del pase
  private async copyImages(passDir: string) {
    const imagesDir = path.join(__dirname, '../../public/images');
    await fs.copy(path.join(imagesDir, 'icon.png'), path.join(passDir, 'icon.png'));
    await fs.copy(path.join(imagesDir, 'logo.png'), path.join(passDir, 'logo.png'));
    await fs.copy(path.join(imagesDir, 'strip.png'), path.join(passDir, 'strip.png'));
  }

  // Helper: Crear el manifiesto
  // Helper: Crear el manifiesto
private async createManifest(passDir: string): Promise<{ [key: string]: string }> {
  const manifest: { [key: string]: string } = {}; // Aquí definimos el tipo

  for (const file of ['pass.json', 'icon.png', 'logo.png', 'strip.png']) {
    const filePath = path.join(passDir, file);
    const fileBuffer = await fs.readFile(filePath);
    manifest[file] = require('crypto').createHash('sha1').update(fileBuffer).digest('hex');
  }

  return manifest;
}

  // Helper: Firmar el manifiesto
  private async signManifest(manifest: any, passDir: string) {
    const certsDir = path.join(__dirname, '../../certificates');
    const signCommand = `openssl smime -sign -signer "${certsDir}/pass.pem" -inkey "${certsDir}/pass.key" ` +
      `-certfile "${certsDir}/WWDR.pem" -in "${path.join(passDir, 'manifest.json')}" -out "${path.join(passDir, 'signature')}" ` +
      `-outform DER -binary`;

    const { stdout, stderr } = await execAsync(signCommand);
    if (stderr) console.error('OpenSSL stderr:', stderr);
    return path.join(passDir, 'signature');
  }

  // Helper: Crear el archivo .pkpass
  private async createPkpass(passDir: string, signature: string, passId: string) {
    const pkpassPath = path.join(this.passesDir, `${passId}.pkpass`);
    const zipCommand = `cd "${passDir}" && zip -r "${pkpassPath}" *`;
    await execAsync(zipCommand);
    return pkpassPath;
  }
}

export const passService = new PassService();