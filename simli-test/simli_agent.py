import logging
import os
import re
import asyncio
import aiohttp

from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, WorkerType, cli, function_tool, room_io
from livekit.plugins import noise_cancellation, openai, simli
from openai.types.beta.realtime.session import TurnDetection
from backend_bridge import normalize_backend_url, request_backend_reply

logging.basicConfig(level=logging.INFO)
load_dotenv(override=False)
BACKEND_URL = normalize_backend_url(os.getenv("BACKEND_URL", "http://localhost:3000/webhook/voice"))
VOICE_SERVICE_TOKEN = os.getenv("VOICE_SERVICE_TOKEN")
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "mara")


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

async def entrypoint(ctx: JobContext):
    await ctx.connect()

    room_match = re.fullmatch(r"mara-user-(\d+)--[0-9a-fA-F-]{36}", ctx.room.name)
    if not room_match:
        raise RuntimeError("Nombre de sala de Mara inválido")
    usuario_id = int(room_match.group(1))
    participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=30)
    if not participant.identity.startswith("cliente-"):
        raise RuntimeError("Participante de cliente inválido")

    http = aiohttp.ClientSession()

    async def close_http():
        if not http.closed:
            await http.close()

    ctx.add_shutdown_callback(close_http)

    @function_tool
    async def consultar_backend_taller(message: str) -> str:
        """Envía al backend exactamente el mensaje pronunciado por el cliente."""
        logging.info(
            "Enviando transcripción al backend | usuario_id=%s | caracteres=%s",
            usuario_id,
            len(message),
        )
        response = await request_backend_reply(
            http, BACKEND_URL, VOICE_SERVICE_TOKEN, usuario_id, message
        )
        return normalizar_moneda_para_voz(response)

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

    logging.info(
        "Sala de voz iniciada | usuario_id=%s | backend=%s | agente=%s",
        usuario_id,
        BACKEND_URL,
        AGENT_NAME,
    )

    # Simli debe quedar unido a la sala antes de iniciar la sesión conversacional.
    # Si no logra entrar, el trabajo falla y el frontend puede permitir reintentar.
    await asyncio.wait_for(simli_avatar.start(session, room=ctx.room), timeout=45)

    await session.start(
        agent=Agent(
            instructions=f"""
            Eres Mara, asistente virtual de Taller Reyes Polo.

            IMPORTANTE:
            Nunca respondas consultas del usuario usando solo tu conocimiento interno.

            Para cada mensaje del usuario, siempre debes llamar primero a la herramienta consultar_backend_taller.

            Debes enviar exactamente:
            - message: el mensaje completo del usuario, sin resumir ni cambiar palabras

            Luego responde exactamente con la respuesta devuelta por consultar_backend_taller.

            La única moneda permitida es el sol peruano.
            Nunca menciones pesos ni dólares.
            Si recibes un precio como "S/ 48.00", pronúncialo como "48 soles".
            Si tiene decimales distintos de cero, pronuncia también los céntimos.

            No agregues información adicional.
            No reinterpretas la respuesta.
            No menciones citas, vehículos, teléfonos o datos del cliente si el backend no los menciona.
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
            participant_identity=participant.identity,
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
            agent_name=AGENT_NAME
        )
    )
