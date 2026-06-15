import logging
import os
import aiohttp

from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, WorkerType, cli, function_tool
from livekit.plugins import openai, simli

logging.basicConfig(level=logging.INFO)
load_dotenv(override=True)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000/webhook")

@function_tool
async def consultar_backend_taller(message: str, session_id: str) -> str:
    
    logging.info(
        f"ENVIANDO A BACKEND | session_id={session_id} | message={message}"
    )
    
    async with aiohttp.ClientSession() as http:
        async with http.post(
            BACKEND_URL,
            json={
                "user_message": message,
                "session_id": session_id,
                "canal": "voz-simli",
                "stt_exitoso": 1,
                "tts_exitoso": 1
            },
            timeout=20
        ) as resp:
            data = await resp.json()
            return data.get("reply") or data.get("response") or "No pude obtener respuesta del taller."

async def entrypoint(ctx: JobContext):
    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model="gpt-realtime",
            voice="coral"
        )
    )

    simli_avatar = simli.AvatarSession(
        simli_config=simli.SimliConfig(
            api_key=os.getenv("SIMLI_API_KEY"),
            face_id=os.getenv("SIMLI_FACE_ID"),
        ),
    )

    await simli_avatar.start(session, room=ctx.room)

    session_id_real = ctx.room.name.replace("mara-room-", "")

    logging.info(f"ROOM NAME LIVEKIT: {ctx.room.name}")
    logging.info(f"SESSION ID REAL PARA BACKEND: {session_id_real}")

    await session.start(
        agent=Agent(
            instructions=f"""
            Eres Mara, asistente virtual de Taller Reyes Polo.

            IMPORTANTE:
            Nunca respondas consultas del usuario usando solo tu conocimiento interno.

            Para cada mensaje del usuario, siempre debes llamar primero a la herramienta consultar_backend_taller.

            Debes enviar exactamente:
            - message: el mensaje completo del usuario
            - session_id: {session_id_real}

            Luego responde exactamente con la respuesta devuelta por consultar_backend_taller.

            No agregues información adicional.
            No reinterpretas la respuesta.
            No menciones citas, vehículos, teléfonos o datos del cliente si el backend no los menciona.
            Si el usuario solo saluda o pregunta cómo estás, responde de forma breve y natural.

            No inventes datos del taller.
            No pidas nombre, teléfono o vehículo por tu cuenta.
            Si el backend ya conoce esos datos, usa lo que diga el backend.

            Responde siempre en español, con tono amable, profesional y cercano.
            Usa frases cortas y naturales.
            """,
            tools=[consultar_backend_taller]
        ),
        room=ctx.room,
    )

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            agent_name="mara"
        )
    )