// src/controllers/passController.ts
import { Request, Response } from 'express';
import { PassService } from '../services/passService';
import { PushNotificationService } from '../services/pushNotificationService';
import { Cliente } from '../types';
import path from 'path';
import fs from 'fs-extra';

export const generatePass = async (req: Request, res: Response) => {
  try {
    console.log('Recibiendo solicitud para generar pase');
    console.log('Body:', req.body);

    const cliente = req.body;
    
    if (!cliente || !cliente.nombre || !cliente.id) {
      console.log('Datos de cliente inválidos:', cliente);
      return res.status(400).json({
        success: false,
        error: 'Datos del cliente incompletos'
      });
    }

    console.log('Iniciando generación de pase para cliente:', cliente.nombre);
    const passService = new PassService();

    try {
      // Verificar que los directorios existen
      const directories = [
        path.join(__dirname, '../../public'),
        path.join(__dirname, '../../public/passes'),
        path.join(__dirname, '../../certificates'),
        path.join(__dirname, '../../templates')
      ];

      for (const dir of directories) {
        if (!fs.existsSync(dir)) {
          console.log(`Creando directorio: ${dir}`);
          fs.mkdirSync(dir, { recursive: true });
        } else {
          console.log(`Directorio existe: ${dir}`);
        }
      }

      // Verificar que los archivos necesarios existen
      const requiredFiles = {
        'pass.pem': path.join(__dirname, '../../certificates/pass.pem'),
        'pass.key': path.join(__dirname, '../../certificates/pass.key'),
        'WWDR.pem': path.join(__dirname, '../../certificates/WWDR.pem'),
        'icon.png': path.join(__dirname, '../../templates/icon.png'),
        'logo.png': path.join(__dirname, '../../templates/logo.png'),
        'strip.png': path.join(__dirname, '../../templates/strip.png')
      };

      for (const [name, filePath] of Object.entries(requiredFiles)) {
        if (!fs.existsSync(filePath)) {
          console.error(`Archivo faltante: ${name} en ${filePath}`);
          throw new Error(`Archivo requerido faltante: ${name}`);
        } else {
          console.log(`Archivo encontrado: ${name}`);
        }
      }

      const passUrl = await passService.generatePass(cliente);
      console.log('Pase generado exitosamente:', passUrl);

      res.json({
        success: true,
        passUrl
      });
    } catch (error) {
      console.error('Error detallado al generar pase:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error en generatePass:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al generar el pase'
    });
  }
};

export const getPass = async (req: Request, res: Response) => {
  try {
    const { passId } = req.params;
    console.log('Solicitando pase:', passId);

    const passService = new PassService();
    const passPath = await passService.getPassPath(passId);
    
    console.log('Pase encontrado en:', passPath);
    res.download(passPath);
  } catch (error) {
    console.error('Error al servir el pase:', error);
    res.status(404).json({
      success: false,
      error: 'Pase no encontrado'
    });
  }
};

export const updatePass = async (req: Request, res: Response) => {
  try {
    const { passId } = req.params;
    const cliente: Cliente = req.body;
    
    const passService = new PassService();
    const passUrl = await passService.generatePass(cliente);

    res.json({
      success: true,
      passUrl
    });
  } catch (error) {
    console.error('Error updating pass:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar el pase'
    });
  }
};

// Nuevos controladores

export const registerDevice = async (req: Request, res: Response) => {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
    const { pushToken } = req.body;

    const pushService = new PushNotificationService();
    await pushService.registerDevice({
      pushToken,
      deviceLibraryIdentifier,
      passTypeIdentifier,
      serialNumber
    });

    res.status(201).json({ status: 'registered' });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Error registering device' });
  }
};

export const unregisterDevice = async (req: Request, res: Response) => {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
    // Implementar lógica para eliminar el token
    res.status(200).json({ status: 'unregistered' });
  } catch (error) {
    console.error('Error unregistering device:', error);
    res.status(500).json({ error: 'Error unregistering device' });
  }
};

export const getSerialNumbers = async (req: Request, res: Response) => {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
    const { passesUpdatedSince } = req.query;
    
    // Implementar lógica para obtener números de serie actualizados
    res.json({
      serialNumbers: ['123456789'],
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting serial numbers:', error);
    res.status(500).json({ error: 'Error getting serial numbers' });
  }
};

export const handlePassUpdate = async (req: Request, res: Response) => {
  try {
    const { passTypeIdentifier, serialNumber } = req.params;
    
    const passService = new PassService();
    const passPath = await passService.getPassPath(`${Date.now()}-${serialNumber}`);
    
    res.download(passPath);
  } catch (error) {
    console.error('Error updating pass:', error);
    res.status(500).json({ error: 'Error updating pass' });
  }
};