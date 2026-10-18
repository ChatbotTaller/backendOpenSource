import logging
from urllib.parse import urlsplit, urlunsplit


def normalize_backend_url(value: str) -> str:
    """Normaliza la configuración del agente a la ruta interna de voz."""
    raw = str(value or "").strip()
    parts = urlsplit(raw)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise ValueError("BACKEND_URL debe ser una URL HTTP(S) válida")

    path = parts.path.rstrip("/")
    if path in {"", "/webhook"}:
        path = "/webhook/voice"
    elif path != "/webhook/voice":
        raise ValueError("BACKEND_URL debe terminar en /webhook/voice")

    return urlunsplit((parts.scheme, parts.netloc, path, "", ""))


async def request_backend_reply(http, backend_url: str, service_token: str,
                                usuario_id: int, message: str) -> str:
    if not service_token:
        raise RuntimeError("VOICE_SERVICE_TOKEN no está configurado")

    try:
        async with http.post(
            normalize_backend_url(backend_url),
            headers={"X-Voice-Service-Token": service_token},
            json={
                "user_message": message,
                "usuario_id": usuario_id,
                "canal": "voz-simli",
            },
            timeout=20,
        ) as response:
            flow_version = response.headers.get("X-Mara-Flow-Version", "desconocida")
            logging.info(
                "Respuesta del backend de voz | estado=%s | version=%s",
                response.status,
                flow_version,
            )

            if response.status == 401 or response.status == 403:
                return "La conexión segura con el taller no está autorizada. Intenta nuevamente en un momento."
            if response.status >= 500:
                return "El sistema del taller no está disponible temporalmente. Intenta nuevamente en un momento."

            try:
                payload = await response.json()
            except Exception:
                logging.warning("El backend de voz devolvió una respuesta no JSON")
                return "No pude procesar la respuesta del taller. Intenta nuevamente."

            if response.status >= 400:
                return payload.get("reply") or "No pude completar esa operación. Intenta nuevamente."

            reply = payload.get("reply") or payload.get("response")
            return reply or "No pude obtener una respuesta del taller."
    except TimeoutError:
        logging.warning("Tiempo de espera agotado al consultar el backend de voz")
        return "El taller está tardando en responder. Intenta nuevamente en un momento."
    except Exception as error:
        logging.error("Fallo al consultar el backend de voz | tipo=%s", type(error).__name__)
        return "No pude conectar con el sistema del taller. Intenta nuevamente en un momento."
