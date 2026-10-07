# Auditoría técnica final — Asistente Conversacional Taller Reyes Polo S.A.C.

Fecha de revisión: 6 de octubre de 2026  
Alcance: backend Node.js/Express, frontend Angular, MySQL, agentes, voz, despliegue, pruebas, configuración y seguridad.  
Marco de referencia: requisitos del proyecto y controles técnicos inspirados en NTP-ISO/IEC 27001:2022. Este informe no declara certificación ni cumplimiento ISO.

## 1. Resumen ejecutivo

La auditoría verificó la implementación real y corrigió los principales riesgos encontrados: sesiones de cliente derivadas del DNI, confianza en identificadores enviados por el navegador, secretos administrativos opcionales, autorización incompleta, cancelación de citas sin comprobar propietario, posibilidad de reservas concurrentes, CORS abierto, integraciones legacy montadas por defecto y métricas STT/TTS artificiales.

Después de los cambios, el backend superó 77 pruebas automatizadas en 11 suites; `npm audit --omit=dev` reportó 0 vulnerabilidades conocidas en dependencias de producción, mientras que el audit completo conserva alertas moderadas en herramientas locales de desarrollo (Jest/Istanbul y Autocannon); todos los archivos JavaScript revisados pasaron validación sintáctica; y Angular compiló correctamente. Permanecen verificaciones externas que no deben declararse como demostradas: uptime histórico, pruebas reales multi-navegador/dispositivo, estudios con usuarios, una llamada LiveKit/Simli completa en producción y resultados actuales de carga contra un entorno aislado.

Resultado final: 16 requisitos cumplidos y 10 parcialmente cumplidos. Ninguno queda como no cumplido a nivel de implementación base, pero los estados parciales requieren evidencia operativa o mejoras de ciclo de vida, monitoreo, privacidad o compatibilidad.

## 2. Arquitectura real revisada

- Frontend Angular: proyecto `FrontTallerReyes`; rutas para DNI, selector, chat de texto/voz, login y panel administrativo.
- Backend Express: `src/server.js`, rutas, controladores, servicios y middleware separados.
- Persistencia MySQL: `usuarios`, `conversaciones`, `mensajes`, `chatbot_context`, `citas`, `estado_cita_temporal`, `clientes`, `metricas_chatbot`, `inventario`, `servicios`, `horarios`, `info_taller` y tablas auxiliares.
- Agentes: clasificador, citas, inventario, servicios, horarios, información, contexto y memoria.
- Integraciones activas: OpenAI, API Perú, MySQL, LiveKit/Simli y Google Calendar cuando está configurado.
- Integraciones legacy: Retell y WhatsApp. Quedan deshabilitadas por defecto mediante `ENABLE_RETELL=false` y `ENABLE_WHATSAPP=false`.
- Despliegue: frontend Vercel, backend/MySQL Railway y comunicación productiva por HTTPS/WSS.
- Documentación: Swagger en `/api-docs` con esquemas Bearer separados para administrador y cliente.
- Pruebas: Jest/Supertest, Selenium y scripts de carga controlados por variables de entorno.

### Análisis de `inventario_backup`

El código de ejecución consulta `inventario`; no existe referencia a `inventario_backup` en `src`. Por ello, `inventario_backup` no debe representarse como entidad principal del DER funcional. La revisión inicial del esquema detectó una dependencia desde una tabla auxiliar de consultas, de modo que no se eliminó ni se ejecutó una migración destructiva. Debe conservarse como tabla legacy/backup hasta analizar y retirar formalmente esa dependencia en un mantenimiento separado.

## 3. Matriz inicial

| Código | Estado inicial | Evidencia encontrada | Archivo/ruta | Problema detectado | Acción requerida |
|---|---|---|---|---|---|
| RF01 | PARCIALMENTE CUMPLIDO | Validación DNI y usuario MySQL | `dniController.js`, `/dni/verificar` | Sesión predecible basada en DNI y confianza en payload | Sesión opaca y middleware cliente |
| RF02 | CUMPLIDO | Angular consumía `/webhook`; respuesta visible | `chatbot.service.ts`, `webhookController.js` | Faltaba endurecer autenticación/payload | Proteger y validar |
| RF03 | CUMPLIDO | Clasificador y agentes especializados | `classifierAgent.js`, agentes | Sin hallazgo funcional crítico | Mantener pruebas |
| RF04 | PARCIALMENTE CUMPLIDO | Alta, consulta y cancelación en MySQL | `appointmentAgent.js`, `citasController.js` | Carrera entre disponibilidad/insert y propiedad insuficiente | Transacción, bloqueo y ownership |
| RF05 | PARCIALMENTE CUMPLIDO | Conversaciones y mensajes persistentes | `memoryAgent.js`, `contextAgent.js` | Podía crear usuario desde sesión arbitraria | Aceptar solo usuario autenticado |
| RF06 | PARCIALMENTE CUMPLIDO | Panel, citas, métricas y exportación | Angular admin, rutas `/citas`, `/metricas` | JWT con secreto fallback y guard superficial | Secreto obligatorio, rol y manejo 401/403 |
| RF07 | PARCIALMENTE CUMPLIDO | LiveKit/Simli/STT/TTS presentes | `livekitRoutes.js`, `simli_agent.py` | Sala/identidad controlable por cliente y contexto frágil | Generación server-side y servicio interno |
| RNF01 | PARCIALMENTE CUMPLIDO | Tiempo en respuesta y tabla de métricas | `metricsService.js`, scripts de carga | STT/TTS constantes y faltaban muestras reales | Usar real o `NULL`; actualizar carga |
| RNF02 | PARCIALMENTE CUMPLIDO | Login, JWT y guards | middleware/guards | Secretos opcionales y sesión cliente falsificable | Endurecer ambos controles |
| RNF03 | PARCIALMENTE CUMPLIDO | URLs cloud configuradas | Angular environments, Railway/Vercel | Sin readiness ni evidencia histórica | `/health`, `/ready`; no afirmar uptime |
| RNF04 | PARCIALMENTE CUMPLIDO | Flujos principales visibles | componentes Angular | Sin prueba formal con usuarios | Mantener evaluación técnica y capturas |
| RNF05 | PARCIALMENTE CUMPLIDO | CSS responsive y viewport | estilos Angular | Sin matriz automatizada de navegadores/dispositivos | Compilar y probar manualmente |
| RNF06 | CUMPLIDO | Separación por capas y agentes | estructura `src` y Angular | Configuración podía validarse mejor | Centralizar validación de entorno |
| RFSI01 | PARCIALMENTE CUMPLIDO | Login y middleware | `authMiddleware.js` | Fallback JWT y sin rol explícito | Secret obligatorio y claim de rol |
| RFSI02 | PARCIALMENTE CUMPLIDO | DNI antes del selector | DNI/guards | `session_id` basado en DNI y aceptado en body | Token opaco verificado en DB |
| RFSI03 | PARCIALMENTE CUMPLIDO | Vistas administrativas separadas | rutas Angular/Express | Guard decodificaba insuficientemente; faltaba prueba cliente→admin | Validar rol/exp y probar 403 |
| RFSI04 | PARCIALMENTE CUMPLIDO | Mensajes y métricas en DB | memoria/métricas | Logs no estructurados y algunos contenían datos extensos | Logger minimizado y trazabilidad |
| RFSI05 | PARCIALMENTE CUMPLIDO | `.env` y `.gitignore` | configuración/scripts | Credenciales de prueba por defecto | `.env.example` y exigir variables |
| RFSI06 | PARCIALMENTE CUMPLIDO | Middleware en citas/métricas | rutas admin | Faltaban pruebas endpoint por endpoint | Supertest sin/con autorización |
| RNFSI01 | PARCIALMENTE CUMPLIDO | Separación lógica de datos | APIs y DB | Cliente podía inyectar sesión/usuario | Derivar identidad del servidor |
| RNFSI02 | PARCIALMENTE CUMPLIDO | SQL parametrizado y validadores parciales | controladores/agentes | Estados/IDs y reserva concurrente incompletos | Validación estricta y transacción |
| RNFSI03 | PARCIALMENTE CUMPLIDO | Servicios cloud accesibles al inicio | Railway/Vercel | No había readiness ni uptime demostrable | Health checks y evidencia externa |
| RNFSI04 | PARCIALMENTE CUMPLIDO | HTTPS/WSS productivo | environments/LiveKit | CORS permisivo y rutas legacy montadas | Allowlist y feature flags |
| RNFSI05 | PARCIALMENTE CUMPLIDO | Métricas, fechas y tiempos | DB/controladores | Sin log estructurado uniforme ni monitoreo central | Logger seguro; reconocer alcance |
| RNFSI06 | PARCIALMENTE CUMPLIDO | Variables de entorno | `.env`, configuración | No se validaban todas al iniciar | Fail-fast y plantilla segura |
| RNFSI07 | PARCIALMENTE CUMPLIDO | Datos asociados a atención/citas | tablas/servicios | No existe política automática de retención/borrado | Documentar ciclo de vida futuro |

## 4. Cambios realizados

1. Se reemplazaron sesiones `dni_<DNI>` por tokens opacos aleatorios `cs_...` y se dejó de exponer el DNI en la respuesta.
2. Se agregó autenticación de cliente contra MySQL y credencial separada para el servicio de voz.
3. El backend ignora identificadores de usuario/sesión enviados en el body y deriva la identidad autenticada.
4. Los endpoints administrativos exigen JWT firmado, no aceptan secreto fallback y verifican `role=admin`.
5. Angular valida vigencia/rol del JWT, valida la sesión cliente contra backend y reacciona a 401/403.
6. La cancelación de citas comprueba propietario y estado; devuelve 400/404/409 según corresponda.
7. El alta de citas revalida disponibilidad dentro de una transacción y bloqueo nombrado por fecha para evitar doble reserva concurrente.
8. CORS usa allowlist; JSON queda limitado a 100 KB.
9. Se agregaron `/health` y `/ready`.
10. LiveKit genera sala e identidad en servidor; Simli usa `usuario_id` derivado de la sala y un secreto interno.
11. STT solo se marca exitoso cuando llega una transcripción autenticada de voz; TTS permanece `NULL` si no existe confirmación real. Los promedios cuentan solo muestras medidas.
12. Google OAuth requiere administrador para iniciar el flujo y usa `state` aleatorio de un solo uso con expiración.
13. Retell y WhatsApp quedaron clasificados como legacy y deshabilitados por defecto.
14. Se creó `.env.example`, validación fail-fast y scripts sin credenciales por defecto.
15. Se introdujo logging JSON con fecha, evento, ruta, usuario, canal, intención, estado y duración, sin registrar DNI, tokens, contraseñas ni contenido de mensajes.
16. Se actualizaron Swagger y scripts de carga para los nuevos controles.
17. El flujo de citas dejó de heredar automáticamente motivos antiguos: siempre solicita el servicio/problema de la cita actual y bloquea valores de control como “Agendar cita”.
18. La recuperación de vehículos por teléfono se limita al mismo usuario autenticado y las consultas de memoria no sobrescriben vehículo ni motivo.
19. La identificación por DNI recupera de forma determinista la fila más reciente bajo bloqueo transaccional e invalida sesiones de filas duplicadas, sin exponer el DNI en el nombre del bloqueo.

Actualización posterior (2026-10-06): se consolidaron en MySQL los usuarios duplicados por DNI. Se conservaron los usuarios 133 y 263, se reasignaron sus citas y conversaciones, se limpiaron los contextos duplicados y se canceló la cita de prueba incorrecta 11. La operación se verificó antes de `COMMIT`, con respaldos selectivos `aud_backup_*_20261006`. Luego se comprobó que no quedaban grupos de DNI duplicados y se creó el índice único `uq_usuarios_dni`. No se ha hecho commit ni despliegue del código local.

## 5. Archivos modificados o agregados

Backend, agrupados:

- Seguridad/configuración: `.env.example`, `src/config/environment.js`, `src/middlewares/authMiddleware.js`, `src/middlewares/clientAuthMiddleware.js`, `src/utils/logger.js`, `src/utils/validators.js`, `src/server.js`.
- Identidad/chat/voz: `dniController.js`, `webhookController.js`, `memoryAgent.js`, `livekitRoutes.js`, `simli-test/simli_agent.py`, `flujoGeneralService.js`.
- Citas/métricas: `appointmentAgent.js`, `citaOwnershipService.js`, `citasController.js`, `metricasController.js`, `metricsService.js`.
- Rutas/documentación: rutas de auth, citas, DNI, Google, health, LiveKit, métricas y webhook.
- Integraciones/scripts: Google Calendar, WhatsApp, Retell, `crearAdmin.js`, scripts de carga y `webhook-body.json`.
- Pruebas: `security.integration.test.js`, `citaSecurity.test.js`, `appointmentConcurrency.test.js`, `appointmentContextSafety.test.js`, `contextoVehiculo.test.js`, `sessionId.test.js`, `flujoGeneral.test.js` y dependencias de test.

Frontend:

- `auth.guard.ts`, `cliente-auth.guard.ts`, `admin.service.ts`, `chatbot.service.ts`.
- Componentes DNI, selector y chat.
- Scripts Selenium de chat, citas, administración y métricas.

## 6. Endpoints y nivel de protección

| Endpoint | Protección |
|---|---|
| `POST /auth/login` | Público; valida formato y credenciales bcrypt |
| `POST /dni/verificar` | Público; valida DNI y rota sesión opaca |
| `GET /health`, `GET /ready` | Públicos; sin secretos |
| `GET /api-docs` | Público; documentación |
| `GET /cliente/sesion` | Bearer de cliente contra MySQL |
| `POST /webhook` | Bearer de cliente contra MySQL |
| `POST /livekit/token` | Bearer de cliente; sala e identidad server-side |
| `POST /webhook/voice` | `X-Voice-Service-Token` + `usuario_id` válido |
| `GET /citas`, `PUT /citas/:id` | JWT administrador con rol |
| Todos los `/metricas...` | JWT administrador con rol |
| `GET /auth/google` | JWT administrador + OAuth state |
| `GET /auth/google/callback` | Callback público condicionado a state válido |
| Rutas Retell/WhatsApp | No montadas salvo feature flag explícito; legacy |

## 7. Pruebas ejecutadas y resultados

| Prueba | Resultado |
|---|---|
| Jest/Supertest backend | 11 suites, 77 pruebas, 77 aprobadas |
| Sintaxis Node de `src`, `test` y scripts | Aprobada |
| Compilación Angular de producción | Aprobada |
| `npm audit --json` backend | 0 vulnerabilidades conocidas en el árbol actual |
| `git diff --check` backend/frontend | Sin errores de whitespace |
| DNI inválido/válido | 400 / sesión opaca sin exponer DNI |
| Cliente ausente, falso y ajeno | 401; payload no sustituye identidad |
| Admin sin JWT, JWT inválido/expirado y cliente en admin | 401/401/403 |
| Admin con JWT válido | Acceso permitido |
| Estado/ID de cita inválido | 400/404 |
| Cancelación de cita ajena/completada | 403 lógico / conflicto |
| Reserva concurrente solapada | Rollback y conflicto; no ejecuta INSERT |
| Contexto contaminado en cita | No reutiliza “Agendar cita”; confirma vehículo y exige motivo real |
| Pregunta por vehículo registrado | Recupera el vehículo persistido sin sobrescribir el contexto |
| LiveKit sin sesión/con sesión | 401 / sala e identidad server-side |
| Voz sin/mala credencial | 401/403 |
| Readiness DB disponible/no disponible | 200/503 |
| CORS permitido/no permitido | 204/403 |

Advertencias de build Angular: bundle inicial 2.47 MB (470.43 KB sobre presupuesto), CSS del chat 28.50 KB (8.50 KB sobre presupuesto) y `xlsx-js-style` CommonJS. No bloquean esta entrega, pero afectan optimización/mantenibilidad.

## 8. Matriz final

| Código | Estado final | Implementación/evidencia | Prueba ejecutada | Resultado |
|---|---|---|---|---|
| RF01 | PARCIALMENTE CUMPLIDO | DNI validado; token opaco; recuperación determinista, bloqueo transaccional e índice UNIQUE | Supertest; repetición manual del ingreso con el mismo DNI y consulta MySQL | La base consolidada devuelve un solo usuario por DNI; falta desplegar el código local actualizado |
| RF02 | CUMPLIDO | Angular→`/webhook`→controlador→JSON→vista | Build + pruebas de endpoint | Aprobada |
| RF03 | CUMPLIDO | Clasificador enruta a servicios, horarios, info, inventario y citas | Tests existentes de clasificación/flujo | Aprobada |
| RF04 | CUMPLIDO | CRUD operativo, ownership y reserva transaccional | Tests cita/estado/concurrencia | Aprobada |
| RF05 | PARCIALMENTE CUMPLIDO | usuario→conversación→mensajes/contexto en MySQL; voz usa mismo usuario | Tests de sesión, consultas MySQL y prueba manual de vehículo en local y producción | Contextos duplicados consolidados; falta validar el flujo de voz completo y desplegar el código local actualizado |
| RF06 | CUMPLIDO | Panel, login, citas, métricas, actualización y exportación | Build + matriz HTTP admin | Aprobada |
| RF07 | PARCIALMENTE CUMPLIDO | LiveKit/Simli, STT, backend, contexto y TTS implementados | Auth/token probados; falta E2E externo real | Parcial |
| RNF01 | PARCIALMENTE CUMPLIDO | Tiempo de respuesta y script de carga; muestras STT/TTS honestas | Unit/integration; carga no ejecutada contra entorno aislado | Parcial |
| RNF02 | CUMPLIDO | JWT+rol, sesión cliente y guards | Casos 401/403/200 | Aprobada |
| RNF03 | PARCIALMENTE CUMPLIDO | URLs cloud, CORS y health/readiness | Health/readiness local; sin uptime histórico | Parcial |
| RNF04 | PARCIALMENTE CUMPLIDO | Navegación, errores y controles revisados | Build; falta estudio formal con usuarios | Parcial |
| RNF05 | PARCIALMENTE CUMPLIDO | Viewport, breakpoints y UI responsive | Build aprobado; falta matriz real multi-browser | Parcial |
| RNF06 | CUMPLIDO | Capas, agentes, servicios y configuración desacoplada | Inspección + checks | Aprobada |
| RFSI01 | CUMPLIDO | JWT obligatorio, rol admin, guard y redirección | Sin/válido/inválido/expirado | Aprobada |
| RFSI02 | CUMPLIDO | DNI→sesión opaca→usuario; distinta de JWT admin | Pruebas de enlace e inyección | Aprobada |
| RFSI03 | CUMPLIDO | Rutas cliente/admin separadas en backend y frontend | Cliente en admin recibe 403 | Aprobada |
| RFSI04 | CUMPLIDO | Mensajes/métricas DB y logs JSON minimizados | Inspección + pruebas de request | Aprobada |
| RFSI05 | CUMPLIDO | Secretos por entorno, fail-fast y plantilla vacía | Búsqueda en árbol actual + startup | Aprobada; rotar claves históricas si aplicara |
| RFSI06 | CUMPLIDO | Citas/métricas/exportación requieren admin | Pruebas por endpoint sin JWT | Aprobada |
| RNFSI01 | PARCIALMENTE CUMPLIDO | APIs minimizadas y autorizadas | Pruebas de aislamiento; falta cifrado/retención formal | Parcial |
| RNFSI02 | PARCIALMENTE CUMPLIDO | Validación, SQL parametrizado, ownership, bloqueo, transacción e índice UNIQUE en `usuarios.dni` | Tests inválido/ajeno/conflicto/DNI repetido; comprobación MySQL sin duplicados | Migración de datos completada; falta desplegar el código local actualizado y verificarlo en producción |
| RNFSI03 | PARCIALMENTE CUMPLIDO | Health/readiness y despliegue configurado | No existe evidencia suficiente de ≥90 % uptime | Parcial |
| RNFSI04 | CUMPLIDO | HTTPS/WSS productivo, CORS allowlist, OAuth state | CORS tests + configuración | Aprobada en código |
| RNFSI05 | PARCIALMENTE CUMPLIDO | DB y logs con tiempo/canal/intención/error | Falta centralización, alertas y retención de logs | Parcial |
| RNFSI06 | CUMPLIDO | `.env`, `.gitignore`, flags y validación dev/prod | Inspección y búsqueda | Aprobada |
| RNFSI07 | PARCIALMENTE CUMPLIDO | Campos actuales se relacionan con identificación, atención y citas | Falta política/automatización de retención y borrado | Parcial |

## 9. Aspectos que no pueden verificarse automáticamente aquí

- Uptime histórico de Railway, Vercel y MySQL; se requieren paneles o monitoreo externo.
- Meta de disponibilidad ≥90 %; solo se implementaron indicadores de proceso/readiness.
- Calidad percibida, facilidad de uso y accesibilidad con usuarios reales.
- Compatibilidad completa en Chrome, Edge, Firefox, Safari, Android e iOS reales.
- Exactitud real de STT, reproducción TTS, sincronización del avatar y recuperación ante cortes de red.
- Rendimiento productivo actual; no se ejecutó carga contra producción porque modifica datos y consume servicios externos.
- Historial completo de secretos en Git. Si alguna clave real estuvo versionada o compartida, debe rotarse aunque ya no aparezca en el árbol actual.
- Cifrado administrado por Railway/MySQL en reposo y políticas organizacionales de respaldo/retención.
- Verificación productiva del código local actualizado tras el despliegue. La consolidación de usuarios históricos y sus relaciones ya se ejecutó y verificó manualmente en MySQL.

## 10. Evidencias recomendadas para el informe académico

Capturar siempre valores sensibles ocultos, DNI/teléfono anonimizados y tokens recortados.

1. Pantalla de validación DNI y respuesta exitosa sin mostrar el DNI completo ni el token completo.
2. Selector de chat luego de una sesión válida.
3. Acceso directo a `/admin` sin token y redirección al login.
4. Postman `GET /citas` sin Authorization: estado 401.
5. Postman `GET /citas` con token de cliente: estado 403.
6. Postman `GET /citas` con JWT administrador: estado 200, ocultando datos personales.
7. Postman `PUT /citas/:id` con estado inválido: 400; ID inexistente: 404.
8. Swagger `/api-docs` mostrando `AdminBearer`, `ClientBearer`, respuestas 400/401/403/404/409 y health checks.
9. `.env.example` y `.gitignore`; no capturar `.env` real. Si fuera obligatorio, ocultar cada valor.
10. Terminal con `11 passed`, `77 passed`, `npm audit --omit=dev` sin vulnerabilidades de producción y build Angular aprobado.
11. MySQL mostrando solamente IDs anonimizados y relaciones `usuarios`→`conversaciones`→`mensajes` y `usuarios`→`citas`.
12. `/health` con 200 y `/ready` con 200; opcionalmente evidencia controlada de 503 sin DB.
13. Panel Railway mostrando despliegue/health y dominio HTTPS, ocultando variables.
14. Vercel mostrando el frontend servido por HTTPS y URL de producción.
15. DevTools/Network de LiveKit usando `wss://` y una sala `mara-user-<id>--<uuid>`; ocultar token.
16. Mara recibiendo una consulta, respondiendo y conservando contexto entre texto/voz.
17. Panel de métricas mostrando tiempo de respuesta, canal y contadores de muestras STT/TTS.
18. Calendario y lista de citas mostrando estados; probar que una cancelación solo afecta la cita del usuario.
19. CORS: preflight desde origen permitido y rechazo 403 desde origen no autorizado.
20. Google OAuth iniciado por administrador y callback exitoso; ocultar código/token.

## 11. Implementación y demostración en el Capstone

| Requerimiento | Cómo se implementó | Dónde está | Cómo demostrarlo |
|---|---|---|---|
| RF01 | DNI válido y sesión opaca ligada a usuario | DNI controller + client middleware + guard | DNI válido/inválido y `/cliente/sesion` |
| RF02 | Mensaje natural via REST y respuesta Angular | chatbot service, webhook controller, chat | Conversación en pantalla + Network |
| RF03 | Clasificador y agentes especializados | `src/agents` | Preguntas de servicios, horario, info e inventario |
| RF04 | Registro/consulta/cancelación con disponibilidad | appointment agent, citas routes/service | Crear, consultar, cancelar y provocar conflicto |
| RF05 | Conversaciones/mensajes/contexto asociados al usuario | memory/context agents y MySQL | Dos mensajes y consulta DB anonimizada |
| RF06 | Admin de citas, métricas y exportación | Angular admin + rutas protegidas | Login, cambio de estado, gráfico y Excel |
| RF07 | LiveKit/Simli STT→agentes→TTS/avatar | LiveKit route, Simli agent, chat | Llamada real y continuidad de contexto |
| RNF01 | Tiempos y métricas; carga configurable | metrics service y scripts | Dashboard + carga en entorno de prueba |
| RNF02 | JWT admin y sesión cliente separada | middlewares y guards | 401, 403 y acceso autorizado |
| RNF03 | Cloud, CORS y health/readiness | environments, server, health routes | Vercel/Railway HTTPS + health |
| RNF04 | Flujos claros de texto, voz y admin | componentes Angular | Video de tareas; encuesta si existe |
| RNF05 | Breakpoints/viewport y layout responsive | estilos Angular | Desktop y móvil real/DevTools |
| RNF06 | Capas y configuración desacoplada | estructura de proyectos | Diagrama de componentes + árbol del repo |
| RFSI01 | JWT obligatorio con rol y expiración | auth controller/middleware/guard | Admin sin token, expirado y válido |
| RFSI02 | Token cliente opaco validado en DB | DNI/client middleware | Intento con token falso y válido |
| RFSI03 | Privilegios cliente/admin separados | rutas backend + guards | Token cliente contra `/citas` da 403 |
| RFSI04 | DB + logs JSON minimizados | memory, metrics, logger | Log con tiempo/canal sin DNI/token |
| RFSI05 | Secretos solo por entorno | `.env.example`, environment config | Plantilla vacía y variables cloud ocultas |
| RFSI06 | Citas/métricas/exportación bajo admin | rutas admin | Matriz Postman sin/con JWT |
| RNFSI01 | Respuestas minimizadas y ownership | controladores/services | Usuario no puede operar cita ajena |
| RNFSI02 | Validación, SQL parametrizado y transacción | validators, appointment agent | Casos 400/404/409 y test concurrente |
| RNFSI03 | Indicadores de proceso y dependencia | `/health`, `/ready` | 200/503 y paneles de uptime si existen |
| RNFSI04 | HTTPS/WSS, CORS y OAuth state | server/environments/google routes | URLs seguras, CORS rechazado, OAuth |
| RNFSI05 | Eventos, errores y métricas auditables | logger y DB | Logs anonimizados + dashboard |
| RNFSI06 | Configuración validada y flags | environment, `.env.example`, `.gitignore` | Arranque falla sin variables; flags legacy |
| RNFSI07 | Datos limitados al servicio actual | esquema/controladores | Diccionario de datos y plan de retención |

## 12. Configuración necesaria antes de desplegar

Configurar tanto localmente como en Railway, sin versionar valores:

- `JWT_SECRET`: valor aleatorio largo y exclusivo.
- `VOICE_SERVICE_TOKEN`: valor distinto, aleatorio y compartido solo con el worker Simli.
- `CORS_ORIGINS`: URL exacta de Vercel y orígenes de desarrollo autorizados.
- Variables MySQL, OpenAI, API Perú y LiveKit existentes.
- Mantener `ENABLE_RETELL=false` y `ENABLE_WHATSAPP=false` mientras esas integraciones sean legacy.

Para generar cada secreto se puede ejecutar localmente `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`; no copiar el resultado a Git ni a capturas. Si una clave real fue expuesta anteriormente, rotarla en su proveedor y en Railway/Vercel.
