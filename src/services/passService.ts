// src/services/passService.ts

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

const BASE_URL = process.env.API_BASE_URL || 'https://api.leubeautylab.com';

interface ManifestData {
  [key: string]: string;
}

export class PassService {
  private passesDir: string;
  private templatesDir: string;
  private certsDir: string;

  constructor() {
    this.passesDir = path.join(__dirname, '../../public/passes');
    this.templatesDir = path.join(__dirname, '../../templates');
    this.certsDir = path.join(__dirname, '../../certificates');
    
    fs.ensureDirSync(this.passesDir);
    fs.ensureDirSync(this.templatesDir);
    fs.ensureDirSync(this.certsDir);
  }

  async generatePass(cliente: any): Promise<string> {
    const passId = `${Date.now()}-${cliente.id}`;
    const passDir = path.join(this.passesDir, passId);
    
    try {
      await fs.ensureDir(passDir);

      const passData = {
        formatVersion: 1,
        passTypeIdentifier: "pass.com.salondenails.loyalty",
        serialNumber: cliente.id,
        teamIdentifier: "C8PM27PK3X",
        webServiceURL: `${BASE_URL}`,
        authenticationToken: cliente.id,
        organizationName: "Leu Beauty",
        description: `Tarjeta de Fidelidad - ${cliente.nombre}`,
        foregroundColor: "rgb(239, 233, 221)",
        backgroundColor: "rgb(132, 149, 105)",
        labelColor: "rgb(239, 233, 221)",
        storeCard: {
          headerFields: [{ key: "nombre", label: "NOMBRE", value: cliente.nombre, textAlignment: "PKTextAlignmentRight" }],
          auxiliaryFields: [{ key: "nextReward", label: "SIGUIENTE PREMIO", value: cliente.proximaRecompensa, textAlignment: "PKTextAlignmentCenter" }],
          secondaryFields: [{ key: "visits", label: "VISITAS", value: `${cliente.visitas}/5`, textAlignment: "PKTextAlignmentCenter" }],
          backFields: [{ key: "rewards", label: "Programa de Recompensas", value: "• 5 visitas: Postre gratis\n• 10 visitas: Bebida gratis\n• 15 visitas: Gel liso en manos\n• 20 visitas: Gel liso en pies\n• 25 visitas: 10% descuento en uñas" }]
        },
        barcode: { message: cliente.id, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" }
      };

      await fs.writeJson(path.join(passDir, 'pass.json'), passData, { spaces: 2 });

      await fs.copy(path.join(this.templatesDir, 'icon.png'), path.join(passDir, 'icon.png'));
      await fs.copy(path.join(this.templatesDir, 'logo.png'), path.join(passDir, 'logo.png'));
      await fs.copy(path.join(this.templatesDir, 'strip@3x.png'), path.join(passDir, 'strip.png'));

      const manifest: ManifestData = {};
      for (const file of ['pass.json', 'icon.png', 'logo.png', 'strip.png']) {
        const filePath = path.join(passDir, file);
        const fileBuffer = await fs.readFile(filePath);
        manifest[file] = require('crypto').createHash('sha1').update(fileBuffer).digest('hex');
      }
      const manifestPath = path.join(passDir, 'manifest.json');
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      const certFiles = {
        signer: path.join(this.certsDir, 'pass.pem'),
        key: path.join(this.certsDir, 'pass.key'),
        wwdr: path.join(this.certsDir, 'WWDR.pem')
      };

      const signCommand = `openssl smime -sign -signer "${certFiles.signer}" -inkey "${certFiles.key}" -certfile "${certFiles.wwdr}" -in "${manifestPath}" -out "${path.join(passDir, 'signature')}" -outform DER -binary`;
      await execAsync(signCommand);

      const pkpassPath = path.join(this.passesDir, `${passId}.pkpass`);
      const zipCommand = `cd "${passDir}" && zip -r "${pkpassPath}" *`;
      await execAsync(zipCommand);

      await fs.remove(passDir);

      return `/passes/${passId}.pkpass`;
    } catch (error) {
      await fs.remove(passDir);
      throw error;
    }
  }

  async getPassPath(passId: string): Promise<string> {
    const passPath = path.join(this.passesDir, `${passId}.pkpass`);
    if (await fs.pathExists(passPath)) {
      return passPath;
    }
    throw new Error('Pass not found');
  }
}

export const passService = new PassService();