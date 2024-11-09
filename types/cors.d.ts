declare module 'cors' {
    import express from 'express';
  
    function cors(options?: cors.CorsOptions): express.RequestHandler;
  
    namespace cors {
      interface CorsOptions {
        origin?: boolean | string | RegExp | ((requestOrigin: string, callback: (err: Error, allow?: boolean) => void) => void);
        methods?: string | string[];
        allowedHeaders?: string | string[];
        exposedHeaders?: string | string[];
        credentials?: boolean;
        maxAge?: number;
        preflightContinue?: boolean;
        optionsSuccessStatus?: number;
      }
    }
  
    export = cors;
  }