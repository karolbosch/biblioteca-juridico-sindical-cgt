# Proyecto consultas Jurídico/Sindical — MVP

Aplicación web instalable con identidad visual CGT que trata la documentación como autoridad y la IA como interfaz. Incluye frontend PWA, API Cloudflare Worker, D1, R2, Workers AI opcional, administración privada, automatización documental y pruebas.

## Qué funciona

- Respuesta directa y motivada a la consulta, con 121 fichas iniciales y modo documental sin IA.
- Botón desplegable de documentos relacionados: primero ET y convenio, después guía CGT y finalmente jurisprudencia.
- Buscador de materias frecuentes que reduce las tarjetas según el texto; «horas sindicales» deja Derechos sindicales.
- Búsqueda y filtros por tipo, sector, órgano y estado procesal.
- Ranking que prioriza jerarquía y autoridad final y penaliza resoluciones revocadas/anuladas.
- Fichas con advertencia visible y componente de cadena procesal.
- Acceso específico de Contact Center y fuente doctrinal CGT diferenciada.
- API `/api/ask`, fallback basado en reglas y citas de fichas recuperadas.
- Área `/admin/`, autenticación PBKDF2, cookie HttpOnly/Secure/SameSite, CSRF y CORS limitado.
- Karol como administración inicial mediante secreto, creación de usuarios y subida manual de sentencias PDF.
- PDF a R2 privado, validación de firma, tamaño, nombre seguro, SHA-256 y duplicados.
- Búsqueda diaria en fuentes oficiales configuradas, copia directa para documentos públicos oficiales y anonimización preliminar solo cuando sea necesaria; correo con enlaces directos para revisión y publicación.
- Publicación bloqueada hasta anonimización y verificación humana completas.
- Instalación desde navegador en Android y desde «Añadir a pantalla de inicio» en iPhone/iPad.
- D1 FTS5, tablas relacionales, auditoría e importador de corpus.

## Inicio local

No hace falta instalar nada para ver el frontend:

```bash
python -m http.server 4173 --directory docs
```

Abrir `http://localhost:4173`. El backend se activa indicando su URL en `docs/config.js`. La instalación real de la PWA requiere HTTPS (GitHub Pages ya lo proporciona).

## Verificación

```bash
npm test
npm run validate:data
python tools/validate_schema.py
node --check worker/src/index.js
```

## Estructura

- `docs/`: GitHub Pages, páginas pública, sectorial y privada.
- `worker/src/`: API separada por agente, búsqueda, autenticación, seguridad y subidas.
- `worker/migrations/`: esquema D1 completo y FTS5.
- `tools/`: importación, auditoría de privacidad, validación y cadenas.
- `tests/`: ranking procesal, fallback, privacidad, archivos y contraseñas.
- `INVENTORY.md`, `ARCHITECTURE.md`, `TODO.md`, `DEPLOYMENT.md`: inventario, diseño, estado y despliegue.

## Estrategia de contenidos por sector

La biblioteca nace especializada en **telemarketing / Contact Center** (convenio, jurisprudencia sectorial, actuaciones ITSS), pero el modelo de datos ya es multisectorial:

- Documentos con `sector: "contact-center"`: jurisprudencia y convenio propios del sector.
- Documentos con `sector: "laboral-general"`: Estatuto de los Trabajadores y Guía Jurídico-Sindical CGT, marcados como fundamentales y mostrados en cualquier sector (`withFoundations()` en `docs/app.js`).

Para incorporar un nuevo sector en el futuro no hace falta tocar código: basta con etiquetar los documentos nuevos con su `sector` correspondiente al subirlos o importarlos, y crear una página de acceso directo copiando `docs/sector/contact-center/index.html` y cambiando el slug y el nombre. El buscador, los filtros y el agente de IA funcionan igual para cualquier sector sin cambios adicionales.



Esta herramienta tiene finalidad documental y de apoyo a la acción sindical. No sustituye el asesoramiento jurídico profesional ni la valoración individual de cada caso.

