import logging
import os
import re
import aiohttp

from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, WorkerType, cli, function_tool, room_io
from livekit.plugins import noise_cancellation, openai, simli
from openai.types.beta.realtime.session import TurnDetection

logging.basicConfig(level=logging.INFO)
load_dotenv(override=True)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000/webhook/voice")
VOICE_SERVICE_TOKEN = os.getenv("VOICE_SERVICE_TOKEN")


def normalizar_moneda_para_voz(texto: str) -> str:
    def reemplazar_soles(match: re.Match[str]) -> str:
        monto = match.group(1).replace(",", ".")
        entero, _, decimales = monto.partition(".")
        soles = int(entero)
        centimos = int(decimales.ljust(2, "0")[:2]) if decimales else 0

        if centimos:
            return f"{soles} soles con {centimos} céntimos"

        return f"{soles} soles"

    respuesta = re.sub(r"S/\s*(\d+(?:[.,]\d{1,2})?)", reemplazar_soles, str(texto))
    return re.sub(r"\bpesos?\b", "soles", respuesta, flags=re.IGNORECASE)

@function_tool
async def consultar_backend_taller(message: str, usuario_id: int) -> str:
    if not VOICE_SERVICE_TOKEN:
        raise RuntimeError("VOICE_SERVICE_TOKEN no está configurado")

    logging.info(
        "Enviando transcripción al backend | usuario_id=%s | caracteres=%s",
        usuario_id,
        len(message),
    )
    
    async with aiohttp.ClientSession() as http:
        async with http.post(
            BACKEND_URL,
            headers={"X-Voice-Service-Token": VOICE_SERVICE_TOKEN},
            json={
                "user_message": message,
                "usuario_id": usuario_id,
                "canal": "voz-simli"
            },
            timeout=20
        ) as resp:
            data = await resp.json()
            respuesta = data.get("reply") or data.get("response") or "No pude obtener respuesta del taller."
            return normalizar_moneda_para_voz(respuesta)

async def entrypoint(ctx: JobContext):
    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model="gpt-realtime",
            voice="coral",
            turn_detection=TurnDetection(
                type="server_vad",
                threshold=0.75,
                prefix_padding_ms=300,
                silence_duration_ms=650,
                create_response=True,
                interrupt_response=True,
            ),
        )
    )

    simli_avatar = simli.AvatarSession(
        simli_config=simli.SimliConfig(
            api_key=os.getenv("SIMLI_API_KEY"),
            face_id=os.getenv("SIMLI_FACE_ID"),
        ),
    )

    await simli_avatar.start(session, room=ctx.room)

    room_payload = ctx.room.name.removeprefix("mara-user-")
    usuario_id = int(room_payload.split("--", 1)[0])

    logging.info("Sala de voz iniciada | usuario_id=%s", usuario_id)

    await session.start(
        agent=Agent(
            instructions=f"""
            Eres Mara, asistente virtual de Taller Reyes Polo.

            IMPORTANTE:
            Nunca respondas consultas del usuario usando solo tu conocimiento interno.

            Para cada mensaje del usuario, siempre debes llamar primero a la herramienta consultar_backend_taller.

            Debes enviar exactamente:
            - message: el mensaje completo del usuario
            - usuario_id: {usuario_id}

            Luego responde exactamente con la respuesta devuelta por consultar_backend_taller.

            La única moneda permitida es el sol peruano.
            Nunca menciones pesos ni dólares.
            Si recibes un precio como "S/ 48.00", pronúncialo como "48 soles".
            Si tiene decimales distintos de cero, pronuncia también los céntimos.

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
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
                auto_gain_control=True,
            ),
            close_on_disconnect=True,
            delete_room_on_close=True,
        ),
    )

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            agent_name="mara"
        )
    )
