import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body;

  if (!name || !email || !phone|| !message) {
    return res.status(400).json({ error: 'Todos los campos son requeridos.' });
  }

  try {
    const query = 'INSERT INTO mensajes (name, email, phone, message) VALUES (?, ?, ?, ?)';
    const [result] = await pool.execute(query, [name, email, phone, message]);
    res.json({ message: 'Mensaje guardado correctamente.' });
  } catch (error) {
    console.error('Error al guardar:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
