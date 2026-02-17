# Sistema Posesión Efectiva v3.0

Sistema para generar formularios PDF de Posesión Efectiva en Chile.

## ✅ Sin dependencias Python — 100% Node.js

### Instalación local

```bash
npm install
npm start
```

Acceder en: http://localhost:3000

### Deploy en Vercel

1. Sube la carpeta a un repositorio GitHub
2. Importa el proyecto en vercel.com
3. Vercel detecta automáticamente el `vercel.json`
4. **Importante:** La carpeta `template/` debe estar incluida en el repositorio

### Estructura

```
├── server.js         ← Servidor Express (API)
├── fill_pdf.js       ← Llenado PDF con pdf-lib (Node.js puro)
├── vercel.json       ← Configuración Vercel
├── package.json
├── template/         ← Formulario oficial del Registro Civil
└── public/
    └── index.html    ← Interfaz web
```

### Funcionalidades

- Llenado de formulario oficial (386 campos)
- Herederos: hasta 20 en el formulario
- Presunción 20% automática
- Anexo para items que excedan el formulario
- Guardar/cargar borradores
- Sin Python, sin dependencias externas
