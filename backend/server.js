import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno (para desarrollo local, en Railway lee del panel)
dotenv.config();

// Verificar variables de entorno antes de arrancar
const requiredEnv = ['GROQ_API_KEY', 'SUPABASE_URL', 'SUPABASE_KEY'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(`Faltan variables de entorno: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3001;

// Configuración de Groq y Supabase usando tus variables
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Habilitar CORS para permitir peticiones desde cualquier origen (Vercel o Localhost)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Middleware para parsear JSON
app.use(express.json());

// Ruta de prueba para comprobar que el servidor responde
app.get('/', (req, res) => {
  res.send('Backend OK');
});

// ==========================================
// ENDPOINT: Chat con Groq (El Interrogatorio)
// ==========================================
app.post('/api/interact', async (req, res) => {
  try {
    const { currentQuestion, chatHistory = [], secretA, secretB } = req.body;

    // Prompt de sistema para obligar a Groq a actuar como Carter y devolver formato JSON
    const systemPrompt = `
      Eres Carter, un sospechoso siendo interrogado por un detective.
      Responde a las preguntas con actitud.
      Debes devolver ÚNICAMENTE un objeto JSON válido con esta estructura exacta, sin texto adicional:
      {
        "dialogo": "Tu respuesta al detective",
        "disposicion": "CALMADO" | "NERVIOSO" | "IRRITADO" | "HOSTIL" | "CERRADO",
        "estado_secreto_A": "DESCONOCIDO" | "CONFIRMADO" | "CONFESADO",
        "estado_secreto_B": "DESCONOCIDO" | "CONFIRMADO" | "CONFESADO",
        "modelToUse": "sentado"
      }
      Estado actual de secretos - Secreto A (Obsesión): ${secretA}, Secreto B (Tráfico): ${secretB}.
    `;

    // Preparar el historial de mensajes para enviarlo a la API de Groq
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: currentQuestion }
    ];

    // Llamada a Groq. Si el modelo ya no está disponible, cámbialo aquí.
    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      response_format: { type: 'json_object' } // Fuerza la salida JSON
    });

    // Parsear la respuesta y enviarla al frontend
    const responseContent = JSON.parse(chatCompletion.choices[0].message.content);
    res.json(responseContent);

  } catch (error) {
    console.error('Error en Groq:', error);
    res.status(500).json({ error: 'Error interno del servidor al contactar con la IA.' });
  }
});

// ==========================================
// ENDPOINT: Guardar Notas (Supabase)
// ==========================================
app.post('/api/notes', async (req, res) => {
  try {
    const { text, category } = req.body;

    // Si no tienes la tabla 'notes' creada en Supabase, esto fallará y usará el fallback local
    const { data, error } = await supabase
      .from('notes')
      .insert([{ text, category }])
      .select();

    if (error) throw error;

    res.json(data[0]);
  } catch (error) {
    console.warn('No se pudo guardar en Supabase. Devolviendo nota local. Error:', error.message);
    // Fallback: devuelve la nota con un ID temporal si la BD falla
    res.json({ id: Date.now(), text: req.body.text, category: req.body.category });
  }
});

// Iniciar servidor (escucha en todas las interfaces, necesario en Railway)
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor backend corriendo en el puerto ${port}`);
});