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
  
  export interface PassResponse {
    success: boolean;
    passUrl?: string;
    error?: string;
  }