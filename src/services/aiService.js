const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generarRespuesta(contextoDB, mensajeUsuario) {
  try {
    const prompt = `
    Eres el asistente experto del Taller Mecánico "Reyes Polo".

    Usa SOLO estos datos de la base de datos para responder:
    ${contextoDB}

    Reglas:
    - Responde en español.
    - Responde breve, claro y amable.
    - NO uses Markdown.
    - NO uses asteriscos.
    - NO uses negritas.
    - Si das precios, usa formato: S/ 48.00
    - Si mencionas ubicación general, di: Trujillo, La Libertad.
    - No digas "El Porvenir" salvo que aparezca explícitamente en la base de datos.
    - Si no hay datos suficientes, pide más detalles al cliente.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: mensajeUsuario }
      ],
    });
        
    let respuesta = response.choices[0].message.content;

    // Limpieza anti-Markdown
    respuesta = respuesta
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/__/g, "")
      .replace(/_/g, "")
      .replace(/`/g, "")
      .replace(/#{1,6}\s?/g, "")
      .trim();

    return respuesta;
  } catch (error) {
    console.error("❌ Error en OpenAI:", error);
    return "Lo siento, mi conexión falló temporalmente. ¿Podrías intentar de nuevo?";
  }
}

module.exports = { generarRespuesta };