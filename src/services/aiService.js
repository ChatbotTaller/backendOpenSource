const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generarRespuesta(contextoDB, mensajeUsuario) {
  try {
    const prompt = `Eres el asistente experto del Taller Mecánico "Reyes Polo". 
    Usa estos datos de nuestra base de datos para responder al cliente: ${contextoDB}. 
    Responde de forma amable, breve y técnica. Si no hay datos, invita a visitarnos a El Porvenir.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: mensajeUsuario }
      ],
    });
        
    return response.choices[0].message.content;
  } catch (error) {
    console.error("❌ Error en OpenAI:", error);
    return "Lo siento, mi conexión falló temporalmente. ¿Podrías intentar de nuevo?";
  }
}

module.exports = { generarRespuesta };