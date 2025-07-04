import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import axios from 'axios';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clave_por_defecto_insegura';

app.use(cors());
app.use(bodyParser.json());

// Validación de formulario de contacto
const contactSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().min(7).max(20).required(),
  message: Joi.string().trim().min(5).max(1000).required(),
  captcha: Joi.string().required()
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando correctamente!');
});

// Obtener mensajes
app.get('/api/mensajes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, phone, message, status FROM mensajes ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Enviar mensaje de contacto
app.post('/api/contact', async (req, res) => {
  const { error, value } = contactSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { name, email, phone, message, captcha } = value;

  try {
    // Verificar CAPTCHA
    const { data } = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: captcha,
        },
      }
    );

    if (!data.success) {
      return res.status(400).json({ error: 'Captcha inválido. Intenta nuevamente.' });
    }

    // Guardar mensaje en base de datos
    const query = 'INSERT INTO mensajes (name, email, phone, message) VALUES (?, ?, ?, ?)';
    await pool.execute(query, [name, email, phone, message]);

    res.json({ message: 'Mensaje guardado correctamente.' });
  } catch (error) {
    console.error('Error al guardar mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Login con JWT
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email y contraseña son requeridos' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0)
      return res.status(401).json({ message: 'Credenciales inválidas' });

    const user = rows[0];

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass)
      return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

//Insert user
app.post('/api/insert-user', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son requeridos' });
  }

  try {
    const password_hash = await bcrypt.hash(password, 10); // Hashea la contraseña

    await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, password_hash]
    );

    res.status(201).json({ message: 'Usuario creado exitosamente' });
  } catch (error) {
    console.error('❌ Error al insertar usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Actualizar estado de mensaje
app.put('/api/mensajes/:id/status', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  const estadosValidos = ['nuevo', 'contactado', 'descartado'];
  if (!estadosValidos.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const [result] = await pool.query('UPDATE mensajes SET status = ? WHERE id = ?', [status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    res.json({ message: 'Estado actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
