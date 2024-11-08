import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import passRoutes from './routes/passRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Configurar CORS
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Middlewares
app.use(express.json());

// Servir archivos estáticos (los pases)
app.use('/passes', express.static(path.join(__dirname, '../public/passes')));

// Rutas API
app.use('/api/passes', passRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});