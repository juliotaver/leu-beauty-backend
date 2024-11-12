import { firestore } from 'firebase-admin';

export interface Cliente {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  visitas: number;
  ultimaVisita: Date;
  proximaRecompensa: string;
  recompensasCanjeadas: string[];
}

export interface DeviceRegistration {
  deviceLibraryIdentifier: string;
  pushToken: string;
  passTypeIdentifier: string;
  serialNumber: string;
  lastUpdated: firestore.Timestamp;
}