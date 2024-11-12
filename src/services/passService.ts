// src/services/passService.ts

import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';

export class PassService {
  async generatePass(clienteId: string, nombreCliente: string): Promise<string> {
    const passTemplate = {
      formatVersion: 1,
      passTypeIdentifier: "pass.com.example",
      serialNumber: uuidv4(),
      teamIdentifier: "YOUR_TEAM_ID",
      organizationName: "Leu Beauty Lab",
      description: "Pass for loyalty program",
      logoText: nombreCliente,
      backgroundColor: "rgb(255,255,255)",
      foregroundColor: "rgb(0,0,0)",
      labelColor: "rgb(0,0,0)",
      barcode: {
        message: clienteId,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1"
      }
    };

    const passFilename = `${Date.now()}-${passTemplate.serialNumber}.pkpass`;
    const passPath = path.join(__dirname, '../../public/passes', passFilename);

    const passManifest = {
      "pass.json": forge.md.sha1.create().update(JSON.stringify(passTemplate)).digest().toHex(),
      "icon.png": await this.hashFile(path.join(__dirname, '../../public/images/icon.png')),
      "logo.png": await this.hashFile(path.join(__dirname, '../../public/images/logo.png')),
      "strip.png": await this.hashFile(path.join(__dirname, '../../public/images/strip.png'))
    };

    const manifestPath = path.join(__dirname, '../../public/passes', 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(passManifest));

    const manifestHash = forge.md.sha1.create().update(fs.readFileSync(manifestPath, 'utf8')).digest().toHex();

    const pkcs7 = forge.pkcs7.createSignedData();
pkcs7.content = forge.util.createBuffer(JSON.stringify(passManifest), 'utf8');
pkcs7.addCertificate(fs.readFileSync(path.join(__dirname, '../../certificates/pass.pem'), 'utf8'));
pkcs7.addSigner({
  key: fs.readFileSync(path.join(__dirname, '../../certificates/pass.key'), 'utf8'), // Convertimos a string
  certificate: fs.readFileSync(path.join(__dirname, '../../certificates/pass.pem'), 'utf8'), // Convertimos a string
  digestAlgorithm: forge.pki.oids.sha1,
  authenticatedAttributes: [
    {
      type: forge.pki.oids.contentType,
      value: forge.pki.oids.data
    },
    {
      type: forge.pki.oids.messageDigest,
      value: manifestHash
    },
    {
      type: forge.pki.oids.signingTime,
      value: new Date().toISOString() // Cadena en formato ISO, compatible con UTC
    }
  ]
});
pkcs7.sign();

// Usamos forge.asn1.toDer() para convertir pkcs7 a DER y obtener los bytes
const derBytes = forge.asn1.toDer(pkcs7.toAsn1()).getBytes();
const signaturePath = path.join(__dirname, '../../public/passes', 'signature');
fs.writeFileSync(signaturePath, forge.util.encode64(derBytes));

    const zipPath = path.join(__dirname, '../../public/passes', passFilename);
    const archiver = require('archiver');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip');

    archive.pipe(output);
    archive.append(JSON.stringify(passTemplate), { name: 'pass.json' });
    archive.append(fs.createReadStream(path.join(__dirname, '../../public/images/icon.png')), { name: 'icon.png' });
    archive.append(fs.createReadStream(path.join(__dirname, '../../public/images/logo.png')), { name: 'logo.png' });
    archive.append(fs.createReadStream(path.join(__dirname, '../../public/images/strip.png')), { name: 'strip.png' });
    archive.append(fs.createReadStream(signaturePath), { name: 'signature' });
    archive.append(fs.createReadStream(manifestPath), { name: 'manifest.json' });

    await archive.finalize();

    console.log('✅ Pase generado y guardado en:', zipPath);
    return zipPath;
  }

  // src/services/passService.ts

  async getPassPath(passTypeIdentifier: string, serialNumber: string): Promise<string | null> {
    try {
      const filePath = path.join(__dirname, '../../public/passes', `${passTypeIdentifier}-${serialNumber}.pkpass`);
      const fileExists = await fs.promises.access(filePath).then(() => true).catch(() => false);

      return fileExists ? filePath : null;
    } catch (error) {
      console.error('❌ Error al obtener la ruta del pase:', error);
      return null;
    }
  }

  private async hashFile(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = forge.md.sha1.create();
    hash.update(fileBuffer.toString('binary'));
    return hash.digest().toHex();
  }
}

export const passService = new PassService();