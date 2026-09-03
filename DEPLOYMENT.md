# Despliegue gratuito: GitHub Pages + Cloudflare

Los nombres de botones pueden variar con el tiempo. Los comandos no requieren dominio propio.

## 1. Repositorio y GitHub Pages

1. Crear un repositorio público vacío en GitHub.
2. Desde la raíz del proyecto:

   ```bash
   git init
   git add .
   git commit -m "MVP biblioteca jurídico-sindical"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```

3. En **Settings → Pages → Build and deployment**, elegir **GitHub Actions**.
4. El workflow `pages.yml` valida y publica `docs/`. La URL será `https://TU_USUARIO.github.io/TU_REPO/`.

## 2. Recursos Cloudflare

1. Crear una cuenta gratuita, entrar en `worker/` y ejecutar:

   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create biblioteca-juridica-cgt
   npx wrangler r2 bucket create biblioteca-originales-privados
   npx wrangler r2 bucket create biblioteca-anonimizados-publicos
   ```

2. Copiar `wrangler.toml.example` a `wrangler.toml`. Pegar el `database_id` devuelto y cambiar `ALLOWED_ORIGIN` por el origen de Pages, por ejemplo `https://TU_USUARIO.github.io` (sin la ruta del repositorio).
3. La administración inicial ya está configurada con el usuario `Karol`. Generar el hash de la contraseña inicial `1102` desde la raíz (el texto introducido no se guarda ni debe escribirse en ningún archivo):

   ```bash
   node tools/generate_password_hash.mjs
   cd worker
   npx wrangler secret put ADMIN_PASSWORD_HASH
   ```

   En el primer comando, escribir `1102` cuando lo solicite; copiar únicamente el hash resultante en el segundo. `1102` es una contraseña muy débil: debe considerarse temporal y cambiarse antes de incorporar documentación real.

4. Crear tablas y desplegar:

   ```bash
   npx wrangler d1 migrations apply biblioteca-juridica-cgt --remote
   npx wrangler deploy
   ```

5. Copiar la URL `workers.dev`, sin barra final, a `docs/config.js` como `apiBaseUrl`. Confirmar también `ALLOWED_ORIGIN`, volver a hacer commit y push.

## 3. Importar el corpus

Primero generar un plan local; esto no publica documentos:

```bash
python tools/import_corpus.py --metadata docs/data/documents.json --files RUTA_AL_CORPUS --out data/import
```

Revisar `report.json`, duplicados y `r2-manifest.json`. Todos los binarios quedan dirigidos a `private/originals/`, incluso si una carpeta se llamaba “anonimizados”. Después:

```bash
cd worker
npx wrangler d1 execute biblioteca-juridica-cgt --remote --file ../data/import/seed.sql
cd ..
python tools/import_corpus.py --metadata docs/data/documents.json --files RUTA_AL_CORPUS --out data/import --upload-r2 --worker-dir worker
```

No mover objetos a `public/anonymized/` hasta completar la revisión de privacidad en el área administrativa.

## 4. GitHub Actions para el Worker

Crear un token limitado de Cloudflare y añadir en **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

El workflow `worker.yml` ejecuta pruebas y migraciones antes de desplegar.

## 5. Búsqueda, anonimización y correo de revisión

El workflow `discovery.yml` se ejecuta cada día y también puede lanzarse desde **Actions → Buscar, anonimizar y solicitar revisión → Run workflow**. Procesa, en este orden:

1. PDFs subidos por los usuarios creados por Karol.
2. Candidatas que Karol haya devuelto con **Volver a anonimizar**.
3. Sentencias laborales nuevas detectadas en los feeds oficiales habilitados.
4. Copia privada de revisión: los documentos públicos oficiales se conservan sin anonimizar y las demás fuentes se anonimizan de forma preliminar; después se registran en D1 y se envía el correo de revisión.

Añadir estos secretos del repositorio en **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- `SMTP_USERNAME`: cuenta Gmail que envía el aviso.
- `SMTP_APP_PASSWORD`: contraseña de aplicación de Gmail, nunca la contraseña normal.
- `REVIEW_EMAIL`: `cgt.konectabto.elche@gmail.com`.
- `PUBLIC_APP_URL`: URL de Pages completa, sin barra final, por ejemplo `https://TU_USUARIO.github.io/TU_REPO`.

La automatización solo prepara una copia para revisión. Si procede de una fuente pública oficial marcada como tal, no se anonimiza: Karol comprueba autenticidad, vigencia y clasificación jurídica y pulsa **Confirmar y publicar**. Para las demás fuentes, Karol revisa texto, metadatos, objetos, imágenes y OCR; **Volver a anonimizar** las devuelve a la ejecución diaria. Tras la confirmación, la copia se mueve al bucket público y se incorpora al índice de consultas.

Los orígenes se editan en `data/recent_sources.json`. CENDOJ queda como referencia autorizada, no como rastreador masivo: deben respetarse sus condiciones y usarse feeds o permisos oficiales. CURIA está habilitado; EUR-Lex queda preparado para añadir un RSS de alerta laboral concreto.

## 6. Instalación en móviles

- Android: abrir la URL HTTPS y pulsar **Instalar app** o la opción equivalente del navegador.
- iPhone/iPad: abrir la URL, pulsar **Instalar app** y seguir **Compartir → Añadir a pantalla de inicio**.
- Tras una actualización, cerrar y volver a abrir la aplicación instalada permite que el service worker active la versión nueva.

## 7. Comprobaciones finales

1. `/api/health` devuelve `ok: true`, `fallback: true` y `pwa: true`.
2. La portada consulta documentos aun con `apiBaseUrl` vacío.
3. Una contraseña no válida no crea sesión.
4. Un PDF falso es rechazado aunque tenga extensión `.pdf`.
5. Una resolución `REVOCADA` aparece con advertencia y nunca como criterio actual.
6. Ningún objeto bajo `private/originals/` tiene URL pública.
7. El correo llega a la cuenta revisora y cada enlace abre la candidata correspondiente.
8. Una candidata solo aparece en `/api/documents/:id/file` después de la confirmación de Karol.

