import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
      console.log('🔍 Creando directorio temporal:', passDir);
      await fs.ensureDir(passDir);

      const passData = {
        formatVersion: 1,
        passTypeIdentifier: "pass.com.salondenails.loyalty",
        serialNumber: cliente.id,
        teamIdentifier: "C8PM27PK3X",
        webServiceURL: "https://api.leubeautylab.com/api/v1",  // Actualización aquí
        authenticationToken: cliente.id,
        organizationName: "Leu Beauty",
        description: `Tarjeta de Fidelidad - ${cliente.nombre}`,
        foregroundColor: "rgb(239, 233, 221)",
        backgroundColor: "rgb(132, 149, 105)",
        labelColor: "rgb(239, 233, 221)",
        storeCard: {
          headerFields: [
            {
              key: "nombre",
              label: "NOMBRE",
              value: cliente.nombre,
              textAlignment: "PKTextAlignmentRight"
            }
          ],
          auxiliaryFields: [
            {
              key: "nextReward",
              label: "SIGUIENTE PREMIO",
              value: cliente.proximaRecompensa,
              textAlignment: "PKTextAlignmentCenter"
            }
          ],
          secondaryFields: [
            {
              key: "visits",
              label: "VISITAS",
              value: `${cliente.visitas}/5`,
              textAlignment: "PKTextAlignmentCenter"
            }
          ],
          backFields: [
            {
              key: "rewards",
              label: "Programa de Recompensas",
              value: "• 5 visitas: Postre gratis\n• 10 visitas: Bebida gratis\n• 15 visitas: Gel liso en manos\n• 20 visitas: Gel liso en pies\n• 25 visitas: 10% descuento en uñas"
            }
          ]
        },
        barcode: {
          message: cliente.id,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1",
          altText: ":D"
        }
      };

      console.log('📝 Escribiendo pass.json');
      await fs.writeJson(path.join(passDir, 'pass.json'), passData, { spaces: 2 });

      console.log('🖼️ Copiando recursos');
      await fs.copy(path.join(this.templatesDir, 'icon.png'), path.join(passDir, 'icon.png'));
      await fs.copy(path.join(this.templatesDir, 'logo.png'), path.join(passDir, 'logo.png'));
      await fs.copy(path.join(this.templatesDir, 'strip@3x.png'), path.join(passDir, 'strip.png'));

      console.log('📋 Generando manifest.json');
      const manifest: ManifestData = {};
      for (const file of ['pass.json', 'icon.png', 'logo.png', 'strip.png']) {
        const filePath = path.join(passDir, file);
        const fileBuffer = await fs.readFile(filePath);
        manifest[file] = require('crypto')
          .createHash('sha1')
          .update(fileBuffer)
          .digest('hex');
        console.log(`📌 Hash para ${file}:`, manifest[file]);
      }

      const manifestPath = path.join(passDir, 'manifest.json');
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      console.log('🔐 Verificando certificados');
      const certFiles = {
        signer: path.join(this.certsDir, 'pass.pem'),
        key: path.join(this.certsDir, 'pass.key'),
        wwdr: path.join(this.certsDir, 'WWDR.pem')
      };

      for (const [name, filePath] of Object.entries(certFiles)) {
        if (await fs.pathExists(filePath)) {
          console.log(`✅ Certificado encontrado: ${name}`);
        } else {
          console.error(`❌ Certificado no encontrado: ${name}`);
          throw new Error(`Missing certificate: ${name}`);
        }
      }

      console.log('✍️ Firmando el pase');
      const signCommand = `openssl smime -sign -signer "${certFiles.signer}" -inkey "${certFiles.key}" ` +
        `-certfile "${certFiles.wwdr}" -in "${manifestPath}" -out "${path.join(passDir, 'signature')}" ` +
        `-outform DER -binary`;
      
      console.log('📜 Comando de firma:', signCommand);
      const { stdout, stderr } = await execAsync(signCommand);
      if (stderr) console.error('⚠️ OpenSSL stderr:', stderr);
      if (stdout) console.log('ℹ️ OpenSSL stdout:', stdout);

      console.log('📦 Creando archivo .pkpass');
      const pkpassPath = path.join(this.passesDir, `${passId}.pkpass`);
      const zipCommand = `cd "${passDir}" && zip -r "${pkpassPath}" *`;
      console.log('🤐 Comando zip:', zipCommand);
      await execAsync(zipCommand);

      if (await fs.pathExists(pkpassPath)) {
        const stats = await fs.stat(pkpassPath);
        console.log(`✅ Archivo .pkpass creado: ${pkpassPath} (${stats.size} bytes)`);
      } else {
        console.error('❌ Error: No se creó el archivo .pkpass');
        throw new Error('Failed to create .pkpass file');
      }

      await fs.remove(passDir);
      console.log('🧹 Directorio temporal limpiado');

      return `/passes/${passId}.pkpass`;
    } catch (error) {
      console.error('Error in generatePass:', error);
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