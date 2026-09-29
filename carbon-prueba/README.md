# Pruebas de huella de carbono

Esta carpeta contiene todo lo necesario para medir el consumo energetico local
del backend MARA con CodeCarbon. Los scripts y este README se pueden versionar;
el entorno virtual y los resultados generados permanecen locales mediante
`.gitignore`.

## Estructura

```text
carbon-prueba/
|-- .venv/                         Entorno Python local (ignorado)
|-- carbon-load.js                 Generador de carga HTTP
|-- measure-carbon.py              Medicion con CodeCarbon
|-- generate-carbon-report-pdf.py  Generador opcional del PDF
|-- requirements.txt               Dependencias Python
|-- resultados/                    CSV, JSON y Markdown (ignorado)
`-- informes/                      PDF final (ignorado)
```

## Preparacion inicial

Ejecutar desde la raiz de `chatbotOpenSource`:

```powershell
python -m venv .\carbon-prueba\.venv
.\carbon-prueba\.venv\Scripts\python.exe -m pip install -r .\carbon-prueba\requirements.txt
```

## Ejecutar una medicion

Terminal 1:

```powershell
$env:PORT=3100
npm start
```

Esperar hasta que el backend indique que esta escuchando en el puerto 3100.

Terminal 2:

```powershell
.\carbon-prueba\.venv\Scripts\python.exe .\carbon-prueba\measure-carbon.py `
  --base-url http://127.0.0.1:3100 `
  --seconds 60 `
  --rounds 3 `
  --connections 20
```

Los nuevos CSV y JSON se guardan en `carbon-prueba/resultados/`.

## Regenerar el informe PDF

```powershell
.\carbon-prueba\.venv\Scripts\python.exe .\carbon-prueba\generate-carbon-report-pdf.py
```

El PDF se guarda en `carbon-prueba/informes/`.

## Archivos que se suben a Git

- `README.md`
- `carbon-load.js`
- `measure-carbon.py`
- `generate-carbon-report-pdf.py`
- `requirements.txt`

No se suben `.venv/`, `resultados/` ni `informes/`.
