import OpenAI from "openai";
import type { Config } from "@netlify/functions";

function json(status: number, body: unknown) {
  return Response.json(body, { status });
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  const apiKey = Netlify.env.get("APINEX_API_KEY");
  const baseURL = Netlify.env.get("APINEX_BASE_URL");
  const openai = apiKey && baseURL ? new OpenAI({ apiKey, baseURL }) : undefined;
  try {
    if (!apiKey || !baseURL || !openai) {
      return json(500, {
        error:
          "Falta configurar APINEX_API_KEY o APINEX_BASE_URL en las variables de entorno de Netlify.",
      });
    }

    let payload;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 });
    }
    const { messages } = payload ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return json(400, {
        error: "Envía al menos un mensaje para iniciar la conversación.",
      });
    }

    // Solo aceptamos mensajes de usuario y asistente; limitamos el historial
    // para evitar solicitudes demasiado grandes.
    const cleanMessages = messages
      .filter(
        (message) =>
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
      )
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 12000),
      }));

    if (cleanMessages.length === 0) {
      return json(400, { error: "El historial está vacío." });
    }

    const completion = await openai.chat.completions.create({
      model: "free/deepseek-v4.1-flash",
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente útil. Responde en español de forma clara y práctica, salvo que el usuario pida otro idioma.",
        },
        ...cleanMessages,
      ],
    });

    const answer = completion.choices?.[0]?.message?.content;

    if (!answer) {
      return json(502, {
        error: "La API no devolvió una respuesta de texto.",
      });
    }

    return json(200, { answer });
  } catch (error) {
    return json(502, { error: "No se pudo completar la solicitud a ApiNex. Inténtalo de nuevo más tarde." });
  }
};

export const config: Config = { path: "/api/chat" };
