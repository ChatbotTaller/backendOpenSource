# Backend Open Source - Asistente Conversacional Taller Reyes Polo

Este repositorio contiene el backend del sistema **Asistente Conversacional Integrado con Agentes de Voz**, desarrollado para el **Taller Reyes Polo** como parte del proyecto de Capstone Project / Taller Integrador.

El backend fue implementado con **Node.js**, **Express** y **MySQL**, y tiene como finalidad procesar mensajes del chatbot, gestionar citas, registrar métricas, autenticar usuarios administradores, verificar DNI, integrar servicios externos y conectar módulos de voz.

---

## Descripción general del proyecto

El sistema desarrollado permite automatizar la atención al cliente del taller mediante un asistente conversacional capaz de responder consultas, registrar citas, consultar servicios, gestionar contexto conversacional y conectar con tecnologías de voz.

Este backend funciona como el núcleo del sistema, ya que recibe las solicitudes provenientes del frontend Angular, procesa la intención del usuario, consulta la base de datos, utiliza agentes conversacionales especializados y devuelve respuestas estructuradas al cliente.

Además, el backend permite la integración con servicios externos como OpenAI, Google Calendar, WhatsApp Cloud API, LiveKit, Retell y Simli.

---

## Tecnologías utilizadas

- Node.js
- Express.js
- MySQL
- OpenAI API
- Google Calendar API
- WhatsApp Cloud API
- Retell AI
- LiveKit
- Simli
- JWT para autenticación
- Swagger para documentación de endpoints
- Railway para despliegue cloud
- Dotenv para variables de entorno
- Axios para consumo de servicios externos

---

## Estructura del proyecto

```text
chatbottaller-backendopensource/
├── crearAdmin.js
├── package.json
├── simli-test/
│   ├── requirements.txt
│   └── simli_agent.py
└── src/
    ├── server.js
    ├── agents/
    │   ├── agentSkills.js
    │   ├── appointmentAgent.js
    │   ├── classifierAgent.js
    │   ├── contextAgent.js
    │   ├── infoAgent.js
    │   ├── inventoryAgent.js
    │   ├── memoryAgent.js
    │   ├── scheduleAgent.js
    │   └── servicesAgent.js
    ├── config/
    │   └── database.js
    ├── controllers/
    │   ├── authController.js
    │   ├── citasController.js
    │   ├── dniController.js
    │   ├── metricasController.js
    │   ├── webhookController.js
    │   └── whatsappController.js
    ├── middlewares/
    │   └── authMiddleware.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── citasRoutes.js
    │   ├── dniRoutes.js
    │   ├── googleRoutes.js
    │   ├── livekitRoutes.js
    │   ├── metricasRoutes.js
    │   ├── retellRoutes.js
    │   ├── webhookRoutes.js
    │   └── whatsappRoutes.js
    ├── services/
    │   ├── aiService.js
    │   ├── googleCalendarService.js
    │   └── metricsService.js
    └── utils/
        ├── dataExtractor.js
        └── time.js
```

---

## Descripción de carpetas y archivos principales

| Carpeta o archivo | Descripción |
|---|---|
| `crearAdmin.js` | Script utilizado para crear un usuario administrador dentro del sistema. |
| `package.json` | Archivo de configuración del proyecto Node.js, donde se definen dependencias, scripts y metadatos del backend. |
| `simli-test/` | Carpeta destinada a la integración y pruebas del asistente de voz o avatar conversacional mediante Simli. |
| `src/server.js` | Archivo principal del servidor. Configura Express, middlewares, rutas, Swagger y servicios generales del backend. |
| `src/agents/` | Contiene los agentes conversacionales especializados encargados de procesar intenciones, citas, servicios, inventario, horarios, contexto y memoria conversacional. |
| `src/config/` | Contiene la configuración de conexión con la base de datos MySQL. |
| `src/controllers/` | Contiene la lógica principal de cada módulo, como autenticación, citas, verificación de DNI, métricas, webhook y WhatsApp. |
| `src/middlewares/` | Incluye funciones intermedias para proteger rutas y validar el acceso mediante autenticación. |
| `src/routes/` | Define las rutas API REST del sistema, separadas por módulo funcional. |
| `src/services/` | Contiene servicios auxiliares para inteligencia artificial, Google Calendar y métricas. |
| `src/utils/` | Incluye funciones utilitarias para extracción de datos y manejo de fechas u horarios. |

---

## Módulos principales del backend

### 1. Servidor principal

El archivo `server.js` configura el servidor Express, habilita los middlewares necesarios, registra las rutas principales y permite documentar los endpoints mediante Swagger.

Este archivo funciona como punto de entrada del backend.

### 2. Agentes conversacionales

La carpeta `agents/` contiene la lógica conversacional del sistema. Cada agente cumple una función específica dentro del flujo de atención.

| Agente | Función |
|---|---|
| `classifierAgent.js` | Clasifica la intención del mensaje enviado por el usuario. |
| `appointmentAgent.js` | Gestiona el flujo de citas, reservas, cancelaciones o consultas relacionadas. |
| `inventoryAgent.js` | Consulta información relacionada con inventario o repuestos. |
| `servicesAgent.js` | Responde consultas sobre servicios ofrecidos por el taller. |
| `scheduleAgent.js` | Responde consultas sobre horarios de atención. |
| `infoAgent.js` | Responde consultas generales sobre el taller. |
| `contextAgent.js` | Gestiona la persistencia del contexto conversacional. |
| `memoryAgent.js` | Registra usuarios, conversaciones, mensajes y memoria de interacción. |
| `agentSkills.js` | Agrupa habilidades y funciones disponibles para el chatbot. |

### 3. Controladores

La carpeta `controllers/` contiene la lógica principal del backend. Cada controlador administra una funcionalidad específica.

| Controlador | Función |
|---|---|
| `authController.js` | Gestiona el inicio de sesión administrativo y autenticación mediante JWT. |
| `citasController.js` | Permite consultar, actualizar y cancelar citas. |
| `dniController.js` | Verifica el DNI del cliente antes de ingresar al sistema. |
| `metricasController.js` | Gestiona las métricas del chatbot y del módulo de voz. |
| `webhookController.js` | Procesa los mensajes enviados al chatbot y coordina el flujo conversacional. |
| `whatsappController.js` | Permite la integración con WhatsApp Cloud API. |

### 4. Rutas API REST

La carpeta `routes/` contiene las rutas del backend, separadas por módulo para mantener una organización clara.

| Ruta | Descripción |
|---|---|
| `authRoutes.js` | Rutas de autenticación administrativa. |
| `citasRoutes.js` | Rutas para la gestión de citas. |
| `dniRoutes.js` | Rutas para validación de DNI. |
| `googleRoutes.js` | Rutas relacionadas con Google Calendar. |
| `livekitRoutes.js` | Rutas para conexión con LiveKit. |
| `metricasRoutes.js` | Rutas para consulta y evaluación de métricas. |
| `retellRoutes.js` | Rutas para integración con Retell AI. |
| `webhookRoutes.js` | Ruta principal del chatbot. |
| `whatsappRoutes.js` | Rutas para integración con WhatsApp Cloud API. |

### 5. Servicios

La carpeta `services/` contiene servicios reutilizables que permiten integrar funcionalidades externas.

| Servicio | Descripción |
|---|---|
| `aiService.js` | Servicio encargado de comunicarse con la API de inteligencia artificial. |
| `googleCalendarService.js` | Servicio encargado de crear, consultar o cancelar eventos en Google Calendar. |
| `metricsService.js` | Servicio encargado de registrar y calcular métricas del sistema. |

### 6. Configuración de base de datos

La carpeta `config/` contiene la configuración de conexión con la base de datos MySQL.

| Archivo | Descripción |
|---|---|
| `database.js` | Define la conexión del backend con MySQL mediante variables de entorno. |

### 7. Middlewares

La carpeta `middlewares/` contiene funciones intermedias que se ejecutan antes de llegar al controlador.

| Middleware | Descripción |
|---|---|
| `authMiddleware.js` | Valida el token JWT y protege rutas privadas del sistema. |

### 8. Utilidades

La carpeta `utils/` contiene funciones auxiliares reutilizadas en distintas partes del sistema.

| Utilidad | Descripción |
|---|---|
| `dataExtractor.js` | Extrae información relevante desde los mensajes del usuario. |
| `time.js` | Maneja operaciones relacionadas con fechas y horarios. |

---

## Funcionalidades principales

El backend permite realizar las siguientes funcionalidades:

- Procesar mensajes del chatbot mediante el endpoint principal `/webhook`.
- Clasificar la intención del usuario.
- Gestionar citas del taller.
- Consultar servicios, horarios, inventario e información general.
- Registrar usuarios identificados por DNI.
- Registrar conversaciones y mensajes.
- Mantener contexto conversacional.
- Registrar métricas de interacción.
- Medir tiempos de respuesta.
- Gestionar métricas del módulo de voz.
- Autenticar usuarios administradores mediante JWT.
- Integrar respuestas generadas con inteligencia artificial.
- Integrar citas con Google Calendar.
- Integrar mensajes mediante WhatsApp Cloud API.
- Conectar módulos de voz mediante Retell y LiveKit.
- Documentar endpoints mediante Swagger.

---

## Endpoints principales

| Endpoint | Descripción |
|---|---|
| `/` | Ruta inicial para comprobar que el backend está activo. |
| `/webhook` | Procesa mensajes del chatbot y coordina la lógica conversacional. |
| `/citas` | Permite consultar y actualizar citas registradas. |
| `/metricas` | Permite obtener métricas del sistema. |
| `/auth/login` | Permite autenticar al administrador. |
| `/dni/verificar` | Permite validar el DNI del cliente. |
| `/webhook-whatsapp` | Recibe mensajes provenientes de WhatsApp Cloud API. |
| `/retell` | Gestiona integración con llamadas de voz. |
| `/livekit/token` | Genera token para conexión con LiveKit. |
| `/api-docs` | Muestra la documentación de la API mediante Swagger. |

---

## Flujo general de funcionamiento

El backend sigue el siguiente flujo general:

1. El cliente ingresa al sistema desde el frontend o canal externo.
2. El sistema valida su identificación mediante DNI.
3. El usuario envía un mensaje al chatbot.
4. El frontend envía el mensaje al endpoint `/webhook`.
5. El backend registra la interacción y analiza el mensaje.
6. El agente clasificador identifica la intención del usuario.
7. El sistema deriva la consulta al agente correspondiente.
8. Si es necesario, el backend consulta la base de datos MySQL.
9. El servicio de inteligencia artificial genera o complementa la respuesta.
10. El backend devuelve la respuesta al frontend o canal correspondiente.
11. La interacción queda registrada para métricas y seguimiento.

---

## Arquitectura lógica del backend

```text
Cliente / Frontend / WhatsApp / Voz
                |
                v
          Backend Express
                |
                v
        Rutas API REST
                |
                v
          Controladores
                |
                v
     Agentes conversacionales
                |
                v
Servicios externos / Base de datos
                |
                v
 Respuesta al usuario y registro de métricas
```

---

## Integraciones externas

El backend se integra con diferentes servicios externos para ampliar las capacidades del sistema.

| Servicio | Uso dentro del sistema |
|---|---|
| OpenAI API | Generación de respuestas conversacionales mediante inteligencia artificial. |
| Google Calendar API | Registro y sincronización de citas del taller. |
| WhatsApp Cloud API | Recepción y envío de mensajes mediante WhatsApp. |
| Retell AI | Integración con llamadas de voz. |
| LiveKit | Comunicación en tiempo real para módulos de voz. |
| Simli | Pruebas de avatar conversacional. |
| Railway | Despliegue del backend y base de datos cloud. |

---

## Variables de entorno

El backend utiliza variables de entorno para proteger credenciales y configurar servicios externos. Estas variables no deben subirse públicamente al repositorio.

Ejemplo de variables utilizadas:

```env
PORT=3000

DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=3306

JWT_SECRET=your_jwt_secret

OPENAI_API_KEY=your_openai_api_key

WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_verify_token

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=your_google_redirect_uri

LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=your_livekit_url

RETELL_API_KEY=your_retell_api_key
```

---

## Instalación y ejecución local

Para ejecutar el backend de manera local, se deben seguir los siguientes pasos:

### 1. Clonar el repositorio

```bash
git clone https://github.com/ChatbotTaller/backendOpenSource.git
```

### 2. Ingresar al proyecto

```bash
cd backendOpenSource
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Configurar variables de entorno

Crear un archivo `.env` en la raíz del proyecto y agregar las variables necesarias para base de datos, JWT, OpenAI, WhatsApp, Google Calendar, LiveKit y Retell.

### 5. Ejecutar el servidor

```bash
npm start
```

O, si se usa un entorno de desarrollo:

```bash
npm run dev
```

---

## Documentación de API

El backend incluye documentación de endpoints mediante Swagger.

Una vez ejecutado el servidor, se puede acceder a la documentación en:

```text
/api-docs
```

Esta documentación permite visualizar las rutas disponibles, métodos HTTP, parámetros y respuestas del backend.

---

## Uso académico

Este repositorio forma parte del proyecto académico **Asistente Conversacional Integrado con Agentes de Voz**, desarrollado para el Taller Reyes Polo.

El código fuente se presenta como evidencia técnica del desarrollo realizado, incluyendo:

- Backend API REST.
- Agentes conversacionales.
- Integración con inteligencia artificial.
- Persistencia de datos.
- Gestión de citas.
- Métricas del sistema.
- Integración con voz.
- Integración con servicios externos.
- Despliegue cloud.

---

## Evidencia para el informe

Este repositorio puede ser utilizado como evidencia dentro del **Anexo A: Código fuente** del informe de Capstone Project.

Se recomienda incluir en el documento las siguientes capturas:

- Organización ChatbotTaller en GitHub.
- Repositorio backendOpenSource.
- Estructura general del backend.
- Archivo `server.js`.
- Carpeta `agents/`.
- Carpeta `controllers/`.
- Carpeta `routes/`.
- Documentación README del repositorio.

---

## Autoría

Proyecto desarrollado como parte del curso de Capstone Project / Taller Integrador.

Repositorio perteneciente a la organización:

```text
ChatbotTaller
```

URL de la organización:

```text
https://github.com/orgs/ChatbotTaller/repositories
```

---

## Nota

Este repositorio tiene fines académicos y documenta el desarrollo del backend del sistema conversacional para la atención automatizada y gestión de citas del Taller Reyes Polo.
