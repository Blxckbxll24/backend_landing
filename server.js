import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import axios from 'axios';
import Joi from 'joi';
import { pool } from './db.js';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());




const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Contacto',
      version: '1.0.0',
      description: 'Formulario de contacto con verificación reCAPTCHA',
    },
    servers: [
      {
        url: 'http://localhost:' + PORT,
      },
    ],
  },
  apis: ['./server.js'], // O el nombre de tu archivo si es diferente
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


const contactSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().min(7).max(20).required(),
  message: Joi.string().trim().min(5).max(1000).required(),
  captcha: Joi.string().required()
});

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Envía un mensaje de contacto.
 *     tags: [Contacto]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - message
 *               - captcha
 *             properties:
 *               name:
 *                 type: string
 *                 example: Juan Pérez
 *               email:
 *                 type: string
 *                 example: juan@example.com
 *               phone:
 *                 type: string
 *                 example: 5512345678
 *               message:
 *                 type: string
 *                 example: Hola, me interesa su producto.
 *               captcha:
 *                 type: string
 *                 example: token_de_recaptcha
 *     responses:
 *       200:
 *         description: Mensaje guardado correctamente.
 *       400:
 *         description: Error de validación o captcha inválido.
 *       500:
 *         description: Error interno del servidor.
 */
app.post('/api/contact', async (req, res) => {
  const { error, value } = contactSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const { name, email, phone, message, captcha } = value;
  try {
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
    console.log('Captcha response:', data);

    if (!data.success) {
      return res.status(400).json({ error: 'Captcha inválido. Intenta nuevamente.' });
    }
    const query = 'INSERT INTO mensajes (name, email, phone, message) VALUES (?, ?, ?, ?)';
    const [result] = await pool.execute(query, [name, email, phone, message]);
    res.json({ message: 'Mensaje guardado correctamente.' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
