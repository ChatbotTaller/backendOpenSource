# Guía de pruebas manuales de seguridad de la información

Proyecto: Asistente Conversacional Integrado con Agentes de Voz — Taller Reyes Polo S.A.C.

Fecha de preparación: 2026-10-06

Esta guía permite demostrar manualmente los requisitos RFSI01–RFSI06 y RNFSI01–RNFSI07. No declara cumplimiento ISO/IEC 27001; usa la NTP-ISO/IEC 27001:2022 únicamente como marco técnico de referencia.

## 1. Reglas antes de probar

1. Ejecuta primero en local o en un entorno de pruebas. No uses datos personales reales innecesariamente.
2. Si tu `.env` local apunta a MySQL de Railway, las pruebas locales modificarán esa base. Usa registros de prueba claramente identificables o, preferentemente, una base separada.
3. No captures claves, contraseñas, tokens JWT, sesiones `cs_...`, DNI completos ni teléfonos completos. Oculta esos valores antes de tomar una evidencia.
4. No pegues secretos en Swagger, capturas, informes, commits ni conversaciones.
5. Usa una cuenta administradora de prueba y uno o dos DNI autorizados para pruebas académicas.
6. Antes del despliegue rota cualquier secreto que haya sido mostrado en una captura o conversación.

## 2. Preparación del entorno local

### 2.1 Backend

En PowerShell:

```powershell
cd C:\Users\maeg2\OneDrive\Escritorio\chatbot\chatbotOpenSource
npm install
npm start
```

Comprueba en el navegador:

- `http://localhost:3000/health`
- `http://localhost:3000/ready`
- `http://localhost:3000/api-docs`

Resultados esperados:

- `/health`: HTTP 200 y `{"status":"ok"}`.
- `/ready`: HTTP 200 y `{"status":"ready","dependency":"database"}` cuando MySQL responde.
- Swagger abre sin revelar secretos.

### 2.2 Frontend

En otra terminal:

```powershell
cd C:\Users\maeg2\OneDrive\Escritorio\chatbot\FrontTallerReyes
npm install
ng serve
```

Abre `http://localhost:4200`.

### 2.3 Agente de voz

Para una prueba completamente local, el `.env` leído por el agente debe tener:

```env
BACKEND_URL=http://localhost:3000/webhook/voice
```

El `VOICE_SERVICE_TOKEN` debe ser el mismo que usa el backend local. Después ejecuta:

```powershell
cd C:\Users\maeg2\OneDrive\Escritorio\chatbot\chatbotOpenSource\simli-test
python simli_agent.py dev
```

### 2.4 Entorno de Postman

Crea un Environment llamado `Taller Reyes - Seguridad local` con estas variables:

| Variable | Valor inicial | Sensible |
|---|---|---|
| `baseUrl` | `http://localhost:3000` | No |
| `adminUser` | usuario administrador de prueba | Sí |
| `adminPassword` | contraseña de prueba | Sí |
| `adminToken` | vacío | Sí |
| `dniPrueba` | DNI permitido para pruebas | Sí |
| `clientToken` | vacío | Sí |
| `clientTokenB` | vacío | Sí |
| `citaId` | ID de una cita de prueba | No |
| `metricId` | ID de una métrica de prueba | No |
| `voiceServiceToken` | valor local de `VOICE_SERVICE_TOKEN` | Sí |

Marca como secretas las variables sensibles. En las capturas, muestra el nombre de la variable, pero nunca su valor.

## 3. Formato de evidencia recomendado

Para cada caso guarda:

- código de prueba;
- fecha y hora;
- entorno usado: local, pruebas o producción;
- solicitud sin secretos visibles;
- código HTTP;
- respuesta con datos personales ocultos;
- resultado: APROBADA o FALLIDA;
- observación breve.

Nombre sugerido: `RFSI01-P01-admin-sin-token.png`.

## 4. RFSI01 — Autenticación administrativa

### RFSI01-P01: acceso sin autenticación

1. En Postman crea `GET {{baseUrl}}/citas`.
2. En Authorization selecciona `No Auth`.
3. Envía la solicitud.
4. Repite con:
   - `GET {{baseUrl}}/metricas`
   - `GET {{baseUrl}}/metricas/resumen`
   - `GET {{baseUrl}}/metricas/por-intent`
   - `GET {{baseUrl}}/metricas/voz`
   - `GET {{baseUrl}}/auth/google`

Esperado: HTTP 401 en todos y mensaje de token no proporcionado.

Evidencia: una captura de `/citas` y otra de `/metricas`, mostrando URL, 401 y respuesta; no debe aparecer ningún token.

### RFSI01-P02: credenciales incorrectas

1. Crea `POST {{baseUrl}}/auth/login`.
2. Body → raw → JSON:

```json
{
  "usuario": "{{adminUser}}",
  "password": "contraseña-incorrecta"
}
```

3. Envía la solicitud.

Esperado: HTTP 401 y `Credenciales incorrectas`. No debe indicar si el usuario existe.

### RFSI01-P03: login válido y acceso autorizado

1. En la misma petición usa `{{adminPassword}}`.
2. Envía la solicitud.
3. Esperado: HTTP 200, `success: true`, un token y datos administrativos mínimos.
4. Copia el token a `adminToken`; no lo captures.
5. Abre `GET {{baseUrl}}/citas`.
6. Authorization → Bearer Token → `{{adminToken}}`.
7. Envía.

Esperado: HTTP 200.

### RFSI01-P04: protección del frontend

1. Cierra sesión administrativa.
2. Abre DevTools → Application → Local Storage.
3. Confirma que no quede el token administrativo.
4. Escribe directamente `http://localhost:4200/admin`.

Esperado: redirección al login administrativo. Esta prueba complementa, pero no reemplaza, las pruebas del backend.

## 5. RFSI02 — Identidad y sesión del cliente

### RFSI02-P01: DNI inválido

1. Crea `POST {{baseUrl}}/dni/verificar`.
2. Body JSON:

```json
{ "dni": "12ABC" }
```

3. Envía.

Esperado: HTTP 400. El sistema no debe crear sesión.

### RFSI02-P02: DNI válido y sesión opaca

1. Cambia el body a:

```json
{ "dni": "{{dniPrueba}}" }
```

2. Envía.
3. Esperado: HTTP 200 con `usuario.id`, `usuario.nombre` y `session_id` iniciado por `cs_`.
4. Verifica visualmente que la respuesta no devuelva DNI ni teléfono.
5. Guarda `session_id` como `clientToken` sin mostrarlo en capturas.

### RFSI02-P03: validación de sesión

1. Crea `GET {{baseUrl}}/cliente/sesion`.
2. Authorization → Bearer Token → `{{clientToken}}`.
3. Envía.

Esperado: HTTP 200, `valid: true` y solo ID/nombre del usuario.

Repite con `Bearer dni_12345678`.

Esperado: HTTP 401. Un DNI no funciona como sesión.

## 6. RFSI03 — Separación de privilegios

### RFSI03-P01: un cliente no puede usar endpoints administrativos

1. Ejecuta `GET {{baseUrl}}/citas`.
2. Usa `{{clientToken}}` como Bearer Token.

Esperado: HTTP 403 y mensaje de permisos insuficientes para el cliente.

3. Repite con `GET {{baseUrl}}/metricas`.

Esperado: HTTP 403.

### RFSI03-P02: un administrador no sustituye una sesión de cliente

1. Crea `POST {{baseUrl}}/webhook`.
2. Authorization → Bearer Token → `{{adminToken}}`.
3. Body JSON:

```json
{ "user_message": "Hola", "canal": "texto" }
```

Esperado: HTTP 401. El JWT administrativo no debe convertirse en sesión de cliente.

### RFSI03-P03: LiveKit exige cliente válido

1. Ejecuta `POST {{baseUrl}}/livekit/token` sin Authorization.

Esperado: HTTP 401.

2. Repite con `{{clientToken}}` y body:

```json
{
  "roomName": "sala-que-intento-imponer",
  "participantName": "identidad-que-intento-imponer"
}
```

Esperado: HTTP 200, pero el servidor genera su propia sala e identidad; no debe devolver literalmente los valores enviados.

## 7. RFSI04 — Registro y trazabilidad

### RFSI04-P01: interacción trazable sin secretos en logs

1. Con `{{clientToken}}`, envía:

```http
POST {{baseUrl}}/webhook
Authorization: Bearer {{clientToken}}
Content-Type: application/json
```

```json
{
  "user_message": "¿Qué servicios de suspensión ofrecen?",
  "canal": "texto"
}
```

2. Esperado: HTTP 200 con `reply`, `intent` y `response_time_ms`.
3. Revisa la consola del backend.
4. Busca el evento JSON `http_request_completed`.

El log puede mostrar fecha, método, ruta, estado, duración, ID interno, canal e intención. No debe mostrar DNI, teléfono, contraseña, JWT, sesión completa ni texto completo de la consulta/respuesta.

### RFSI04-P02: persistencia de métricas

En MySQL ejecuta una consulta que minimice datos personales:

```sql
SELECT id,
       conversacion_id,
       intencion_detectada,
       tiempo_respuesta_ms,
       canal,
       stt_exitoso,
       tts_exitoso
FROM metricas_chatbot
ORDER BY id DESC
LIMIT 10;
```

Esperado: una fila reciente con intención, canal y tiempo. Oculta IDs si la captura será pública.

### RFSI04-P03: contexto entre mensajes

1. Con el mismo `clientToken`, envía: `Mi vehículo es un Toyota Yaris`.
2. Después envía: `¿Qué vehículo te dije que tengo?`.
3. Esperado: la segunda respuesta utiliza el contexto de la primera.
4. Cierra/reabre el frontend sin volver a cambiar de cliente y valida la sesión.
5. Comprueba en MySQL solo la relación, no el contenido personal:

```sql
SELECT u.id AS usuario_id,
       c.id AS conversacion_id,
       COUNT(m.id) AS cantidad_mensajes
FROM usuarios u
JOIN conversaciones c ON c.usuario_id = u.id
LEFT JOIN mensajes m ON m.conversacion_id = c.id
WHERE u.id = <ID_DE_PRUEBA>
GROUP BY u.id, c.id;
```

## 8. RFSI05 — Protección de credenciales y claves

Ejecuta estos comandos desde la raíz del backend:

```powershell
git check-ignore -v .env
git check-ignore -v google-credentials.json
git check-ignore -v google-token.json
git ls-files .env google-credentials.json google-token.json
git status --short
```

Esperado:

- Los tres primeros aparecen ignorados.
- `git ls-files` no devuelve esos archivos.
- `.env.example` sí aparece como archivo nuevo/modificado para versionar.

Comprueba que el ejemplo no tenga secretos reales:

```powershell
Get-Content .env.example
```

También puedes buscar patrones comunes únicamente entre archivos versionados:

```powershell
git grep -n -E "sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{16,}|Bearer [A-Za-z0-9_-]{20,}"
```

Esperado: ninguna clave real. Revisa manualmente cualquier coincidencia antes de compartirla.

En Railway captura la lista de nombres de variables con todos los valores ocultos. Deben existir, según el servicio:

- backend: `JWT_SECRET`, `VOICE_SERVICE_TOKEN`, DB, CORS y claves de integraciones activas;
- simli-agent: `BACKEND_URL`, `VOICE_SERVICE_TOKEN`, LiveKit, OpenAI y Simli;
- `VOICE_SERVICE_TOKEN` debe coincidir en ambos, sin mostrarlo.

## 9. RFSI06 — Acceso controlado a citas y métricas

Ejecuta cada endpoint primero sin token y luego con `{{adminToken}}`:

| Método | Endpoint | Sin token | Con admin |
|---|---|---:|---:|
| GET | `/citas` | 401 | 200 |
| PUT | `/citas/{{citaId}}` | 401 | 200, 400 o 404 según datos |
| GET | `/metricas` | 401 | 200 |
| GET | `/metricas/resumen` | 401 | 200 |
| GET | `/metricas/por-intent` | 401 | 200 |
| GET | `/metricas/voz` | 401 | 200 |
| PUT | `/metricas/{{metricId}}` | 401 | respuesta validada |
| GET | `/auth/google` | 401 | 302 si Google está configurado |

Para actualizar una cita de prueba:

```json
{ "estado": "confirmada" }
```

No modifiques citas reales durante la demostración.

## 10. RNFSI01 — Confidencialidad

### RNFSI01-P01: evitar suplantación por payload

1. Autentica el request con `{{clientToken}}`.
2. Envía al webhook un `session_id` y `usuario_id` falsos:

```json
{
  "user_message": "¿Cómo me llamo?",
  "session_id": "cs_TOKEN_FALSO_NO_VALIDO",
  "usuario_id": 999999,
  "canal": "texto"
}
```

Esperado: el backend usa la identidad asociada al Bearer Token, no los identificadores del body. La respuesta no debe revelar otro cliente.

### RNFSI01-P02: aislamiento entre dos clientes

1. Obtén `clientToken` para el cliente A y `clientTokenB` para el cliente B.
2. Con A, consulta sus citas.
3. Con B, consulta sus citas.
4. Verifica que B no reciba citas de A.
5. Si pruebas cancelación conversacional, intenta desde B cancelar una cita listada únicamente para A.

Esperado: B no puede consultar ni cancelar recursos de A. Usa citas de prueba.

### RNFSI01-P03: respuestas mínimas

Revisa las respuestas de `/dni/verificar`, `/cliente/sesion`, `/webhook`, `/livekit/token` y `/auth/login`.

Esperado: no incluyen contraseñas, hashes, secretos, DNI, tokens de terceros ni credenciales de base de datos. La sesión del cliente y el JWT solo aparecen cuando son necesarios para iniciar la sesión.

## 11. RNFSI02 — Integridad

### RNFSI02-P01: validación de mensajes

Con `{{clientToken}}`, prueba `POST /webhook` con cada body:

```json
{}
```

```json
{ "user_message": { "texto": "no válido" } }
```

```json
{ "user_message": "<texto de más de 2000 caracteres>" }
```

Esperado: HTTP 400 en los tres casos.

### RNFSI02-P02: integridad de actualización administrativa

Con `{{adminToken}}` prueba:

- `PUT /citas/abc` con `{"estado":"confirmada"}` → 400.
- `PUT /citas/1` con `{"estado":"inventado"}` → 400.
- `PUT /citas/999999999` con `{"estado":"confirmada"}` → 404.

### RNFSI02-P03: cita duplicada concurrente

1. Prepara dos clientes de prueba con los datos completos exigidos por Mara.
2. En dos navegadores intenta confirmar exactamente la misma fecha y hora disponible casi simultáneamente.
3. Esperado: solo una reserva se crea; la otra recibe conflicto o aviso de horario no disponible.
4. Confirma en MySQL que exista una sola cita activa para ese espacio.

Esta condición también está cubierta automáticamente por `test/appointmentConcurrency.test.js`.

## 12. RNFSI03 — Disponibilidad

### Local

1. Abre `/health`; debe responder 200 mientras el proceso esté activo.
2. Abre `/ready`; debe responder 200 únicamente si MySQL responde.
3. Detener MySQL de producción no es una prueba aceptable. La respuesta 503 se demuestra con la prueba automatizada.

### Producción

Después del despliegue coordinado, visita:

- `https://<backend-railway>/health`
- `https://<backend-railway>/ready`
- `https://<frontend-vercel>/`

Captura fecha/hora y HTTP 200. Esto demuestra disponibilidad puntual, no un uptime histórico de 90 %. Para demostrar 90 % se necesitaría monitoreo continuo durante un periodo definido.

## 13. RNFSI04 — Comunicación segura

### RNFSI04-P01: HTTPS y WSS

1. Abre el frontend de Vercel y el backend de Railway.
2. Confirma el candado HTTPS del navegador.
3. En DevTools → Network filtra `WS` durante una llamada de voz.
4. Confirma que LiveKit usa `wss://`.
5. Busca en la configuración de producción cualquier `http://`; localhost puede usar HTTP, producción no.

### RNFSI04-P02: CORS permitido

En PowerShell:

```powershell
curl.exe -i -X OPTIONS "http://localhost:3000/webhook" -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: POST"
```

Esperado: HTTP 204 y `Access-Control-Allow-Origin: http://localhost:4200`.

### RNFSI04-P03: CORS bloqueado

```powershell
curl.exe -i -X OPTIONS "http://localhost:3000/webhook" -H "Origin: https://sitio-no-autorizado.example" -H "Access-Control-Request-Method: POST"
```

Esperado: HTTP 403 y sin autorización CORS para ese origen.

### RNFSI04-P04: secretos fuera de URL

En DevTools → Network revisa las solicitudes del frontend.

Esperado: claves de OpenAI, Simli, LiveKit secretas, DB y `VOICE_SERVICE_TOKEN` no aparecen en query strings ni en el bundle. El token efímero que el backend genera para conectarse a LiveKit es una credencial de sesión y no debe copiarse a evidencias.

## 14. RNFSI05 — Auditabilidad y monitoreo

1. Realiza una consulta de texto válida y una llamada de voz.
2. Revisa logs JSON del backend.
3. Entra al panel administrativo de métricas.
4. Consulta con Postman:
   - `/metricas/resumen`
   - `/metricas/por-intent`
   - `/metricas/voz`
5. Confirma que hay fecha/hora, canal, intención, tiempo y errores operativos cuando corresponda.
6. Confirma que los campos STT/TTS se contabilizan solo cuando fueron medidos; no se debe inventar un éxito de TTS.

Limitación que debe declararse: no existe evidencia de una plataforma externa de centralización, alertas ni política automatizada de retención de logs. Por ello RNFSI05 sigue siendo parcialmente cumplido.

## 15. RNFSI06 — Configuración y cambios seguros

1. Ejecuta las comprobaciones Git de RFSI05.
2. Revisa `.env.example`: debe contener nombres y valores no sensibles.
3. Revisa Railway con los valores ocultos:
   - backend: `NODE_ENV=production`;
   - CORS: solo frontend de producción y orígenes necesarios;
   - `ENABLE_RETELL=false` y `ENABLE_WHATSAPP=false` si no se usan;
   - simli-agent: `BACKEND_URL=https://<backend>/webhook/voice`;
   - mismo `VOICE_SERVICE_TOKEN` en backend y Simli.
4. Comprueba que un commit es local y que solo `git push` activa el despliegue automático.
5. Antes del push revisa `git diff --check`, pruebas, build y variables cloud.

No captures valores reales. No ejecutes `git reset --hard`, migraciones destructivas ni borrados de producción.

## 16. RNFSI07 — Privacidad y minimización

1. Lista los datos realmente usados:
   - DNI: identificación;
   - nombre: atención personalizada;
   - teléfono, vehículo, motivo, fecha y hora: gestión de citas;
   - mensajes/contexto: continuidad conversacional;
   - canal, intención y tiempo: métricas.
2. Revisa una respuesta de cada endpoint y comprueba que no entregue columnas completas con datos innecesarios.
3. Revisa logs y confirma que no guarden DNI, teléfono, tokens ni contenido completo.
4. Para evidencias SQL usa IDs anonimizados y conteos.
5. No elimines columnas sin analizar dependencias.

Limitación que debe declararse: falta definir y automatizar una política formal de retención/eliminación de mensajes, contexto y métricas. Por ello la privacidad/minimización no debe presentarse como totalmente cerrada solo por estas pruebas.

## 17. Seguridad específica del canal de voz

### VOZ-P01: servicio sin credencial

```powershell
curl.exe -i -X POST "http://localhost:3000/webhook/voice" -H "Content-Type: application/json" -d '{"usuario_id":1,"user_message":"Hola"}'
```

Esperado: HTTP 401.

### VOZ-P02: credencial incorrecta

En Postman ejecuta `POST {{baseUrl}}/webhook/voice`, header `X-Voice-Service-Token: valor-incorrecto` y body:

```json
{ "usuario_id": 1, "user_message": "Hola", "canal": "voz-simli" }
```

Esperado: HTTP 403.

### VOZ-P03: ID inválido incluso con credencial válida

Usa `X-Voice-Service-Token: {{voiceServiceToken}}` y:

```json
{ "usuario_id": "otro", "user_message": "Hola" }
```

Esperado: HTTP 400.

### VOZ-P04: flujo real LiveKit/Simli

1. Mantén backend, frontend y `simli_agent.py dev` ejecutándose.
2. Identifica al cliente mediante DNI.
3. Abre el modo voz y realiza dos consultas relacionadas.
4. Verifica que Mara responda, conserve el usuario/contexto y que el backend reciba `/webhook/voice` con HTTP 200.
5. Comprueba en métricas el canal `voz-simli`.
6. Captura los logs sin mostrar tokens ni transcripciones personales.

## 18. Google OAuth administrativo

1. `GET {{baseUrl}}/auth/google` sin token → 401.
2. Repite con `{{adminToken}}`.
3. Si Google está configurado, debe responder 302 hacia Google con un `state` temporal.
4. No captures el código de autorización ni tokens devueltos por Google.

## 19. Pruebas automatizadas y análisis antes del despliegue

Desde el backend:

```powershell
npm test -- --runInBand
npm audit
git diff --check
git status --short
```

Resultado esperado actualmente:

- 11 suites aprobadas;
- 77 pruebas aprobadas;
- `npm audit --omit=dev` sin vulnerabilidades conocidas en producción;
- el audit completo puede conservar alertas moderadas de herramientas de desarrollo que no deben corregirse con `--force` sin evaluar cambios incompatibles;
- `git diff --check` sin errores de espacios;
- `.env` ausente de la lista de archivos a subir.

Desde el frontend:

```powershell
cd C:\Users\maeg2\OneDrive\Escritorio\chatbot\FrontTallerReyes
npm run build
```

Esperado: compilación de producción exitosa. Revisa advertencias, pero diferencia una advertencia de un error que impida construir.

## 20. Lista final de evidencias para el Capstone

1. Login administrativo y rechazo de contraseña incorrecta.
2. Acceso directo a `/admin` sin sesión y redirección.
3. `/citas` sin JWT → 401; con JWT administrativo → 200.
4. `/citas` con sesión de cliente → 403.
5. DNI inválido → 400; DNI válido → sesión opaca con valores ocultos.
6. `/webhook` sin sesión → 401; con sesión → respuesta válida.
7. Dos mensajes que demuestran persistencia del contexto.
8. `/webhook/voice` sin token → 401; token incorrecto → 403.
9. LiveKit/Simli funcionando y usando `/webhook/voice`.
10. CORS aceptando Vercel/local autorizado y rechazando origen ajeno.
11. HTTPS del frontend/backend y WSS de LiveKit.
12. `.gitignore`, `.env.example` y `git check-ignore` sin enseñar secretos.
13. Railway con nombres de variables y valores ocultos.
14. MySQL con relaciones anonimizadas, métricas y tiempos.
15. Logs JSON sin DNI, contraseñas, tokens ni mensajes completos.
16. Panel de citas y métricas autenticado.
17. Swagger con esquemas de seguridad.
18. Resultado de Jest: 11 suites y 77 pruebas.
19. `npm audit --omit=dev` sin vulnerabilidades conocidas en dependencias de producción, documentando por separado las alertas de herramientas de desarrollo.
20. Build Angular exitoso y vista responsive en escritorio/móvil.

## 21. Matriz de correspondencia

| Requisito | Pruebas principales |
|---|---|
| RFSI01 | RFSI01-P01 a P04 |
| RFSI02 | RFSI02-P01 a P03 |
| RFSI03 | RFSI03-P01 a P03 |
| RFSI04 | RFSI04-P01 a P03 |
| RFSI05 | Sección 8 |
| RFSI06 | Sección 9 |
| RNFSI01 | RNFSI01-P01 a P03 |
| RNFSI02 | RNFSI02-P01 a P03 |
| RNFSI03 | Sección 12 |
| RNFSI04 | RNFSI04-P01 a P04 |
| RNFSI05 | Sección 14 |
| RNFSI06 | Sección 15 |
| RNFSI07 | Sección 16 |
