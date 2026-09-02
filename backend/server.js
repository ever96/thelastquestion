import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar Groq y Supabase usando las variables del archivo .env
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 1. Endpoint para procesar el interrogatorio con Groq y guardar el historial en Supabase
app.post('/api/interact', async (req, res) => {
  const { currentQuestion, suspectStress } = req.body;

  try {
    const chatCompletion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: `Eres Carter, un sospechoso en un interrogatorio criminal por un thriller psicológico. 
          Nivel de estrés actual del sospechoso: ${suspectStress}%.
          Responde estrictamente en formato JSON válido con esta estructura exacta, sin texto extra fuera del JSON:
          {
            "dialogue": "Lo que dice Carter en primera persona de forma desafiante, evasiva o nerviosa...",
            "status": "Estado emocional breve (ej: A la defensiva, Nervioso, Intimidado, Desafiante)",
            "stressDelta": número entero entre -25 y +35 que indica cuánto sube o baja el estrés según la pregunta del detective,
            "modelToUse": "sentado" o "detective"
          }`
        },
        { role: "user", content: currentQuestion }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(chatCompletion.choices[0].message.content);

    // Guardar el intercambio en la tabla 'chat_messages' de Supabase
    await supabase.from('chat_messages').insert([
      { sender: 'TÚ', text: currentQuestion },
      { sender: 'CARTER', text: result.dialogue }
    ]);

    res.json(result);
  } catch (error) {
    console.error("Error en el backend con Groq o Supabase:", error);
    res.status(500).json({ error: "Error al procesar la solicitud con el sospechoso." });
  }
});

// 2. Endpoint para guardar notas del detective en Supabase
app.post('/api/notes', async (req, res) => {
  const { text, category } = req.body;

  try {
    const { data, error } = await supabase
      .from('detective_notes')
      .insert([{ text, category: category || 'Observación Personal' }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error("Error al guardar nota en Supabase:", error);
    res.status(500).json({ error: "No se pudo guardar la nota en la base de datos." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor del backend corriendo en el puerto ${PORT}`);
});