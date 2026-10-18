import unittest

from backend_bridge import normalize_backend_url, request_backend_reply


class FakeResponse:
    def __init__(self, status=200, payload=None, headers=None):
        self.status = status
        self.payload = payload or {}
        self.headers = headers or {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def json(self):
        return self.payload


class FakeHttp:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


class BackendBridgeTests(unittest.IsolatedAsyncioTestCase):
    def test_normaliza_base_y_webhook_a_ruta_de_voz(self):
        self.assertEqual(normalize_backend_url("http://localhost:3000"),
                         "http://localhost:3000/webhook/voice")
        self.assertEqual(normalize_backend_url("https://api.example.com/webhook"),
                         "https://api.example.com/webhook/voice")

    def test_rechaza_rutas_incorrectas(self):
        with self.assertRaises(ValueError):
            normalize_backend_url("https://api.example.com/dni/verificar")

    async def test_liga_mensaje_e_identidad_al_backend_de_voz(self):
        http = FakeHttp(FakeResponse(
            payload={"reply": "Estas son tus citas activas."},
            headers={"X-Mara-Flow-Version": "2026-10-18-voice-v2"},
        ))
        reply = await request_backend_reply(
            http, "https://api.example.com/webhook/voice", "token", 263,
            "quiero cancelar una cita que ha sido registrada",
        )
        self.assertEqual(reply, "Estas son tus citas activas.")
        _, options = http.calls[0]
        self.assertEqual(options["json"]["usuario_id"], 263)
        self.assertEqual(options["json"]["canal"], "voz-simli")
        self.assertEqual(options["headers"]["X-Voice-Service-Token"], "token")

    async def test_no_disfraza_error_de_autorizacion_como_falta_de_informacion(self):
        reply = await request_backend_reply(
            FakeHttp(FakeResponse(status=403)),
            "https://api.example.com/webhook/voice", "token", 263, "hola",
        )
        self.assertIn("no está autorizada", reply)


if __name__ == "__main__":
    unittest.main()
