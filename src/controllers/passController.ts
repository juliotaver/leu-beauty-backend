// src/controllers/passController.ts
import { Request, Response } from 'express';
import { PassService } from '../services/passService';
import { PushNotificationService } from '../services/pushNotificationService';
import { Cliente } from '../types';

export const generatePass = async (req: Request, res: Response) => {
  try {
    const cliente: Cliente = req.body;
    console.log('Generando pase para cliente:', cliente);
    
    if (!cliente || !cliente.nombre || !cliente.id) {
      return res.status(400).json({
        success: false,
        error: 'Datos del cliente incompletos'
      });
    }

    const passService = new PassService();
    const passUrl = await passService.generatePass(cliente);

    console.log('Pase generado exitosamente:', passUrl);

    res.json({
      success: true,
      passUrl
    });
  } catch (error) {
    console.error('Error detallado al generar pase:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar el pase'
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