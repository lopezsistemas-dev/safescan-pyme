# Despliegue de la demo (rama `deploy/vercel`)

Esta rama adapta el MVP a Vercel (serverless). Diferencias con `main`:

- **PostgreSQL** en lugar de SQLite (`main` sigue siendo la referencia para ejecución local).
- **Cuarentena y salidas de SafeDocs en la base de datos** (tabla privada `StoredFile`) en lugar del disco: en serverless no hay disco persistente, y así ningún archivo analizado acaba en almacenamiento público.
- `vercel.json` ejecuta las migraciones (`prisma migrate deploy`) en cada build. El seed de la demo se ejecuta **una sola vez** al preparar la base de datos (`prisma db seed`); NO se repite en cada deploy, para no borrar los análisis creados en vivo durante la evaluación. Los datos de fábrica persisten entre despliegues.
- `maxDuration = 60` en las rutas largas (pipeline y SafeDocs).

## Pasos en Vercel (una vez con cuenta)

1. **Add New → Project** → importar `lopezsistemas-dev/safescan-pyme`.
2. En **Settings → Git**, fijar la *Production Branch* a `deploy/vercel` (o desplegar esta rama manualmente).
3. **Base de datos** (elige una):
   - *Opción A — Neon desde Vercel:* pestaña **Storage → Create Database → Neon (Postgres)**. Se inyectan las variables solas; mapear en Environment Variables: `DATABASE_URL` = la URL pooled y `DIRECT_URL` = `DATABASE_URL_UNPOOLED`.
   - *Opción B — Supabase:* en el proyecto Supabase, **Connect →** copiar *Transaction pooler* (puerto 6543) como `DATABASE_URL` y *Direct connection* (puerto 5432) como `DIRECT_URL`.
4. **Environment Variables** (además de las anteriores):
   - `MOCK_SECURITY_ANALYSIS=true` (demo simulada, sin claves)
   - `MAX_UPLOAD_MB=4` (límite de cuerpo de petición en Vercel: ~4,5 MB)
   - `RETENTION_HOURS=24`
   - (opcionales) `GEMINI_API_KEY`, `GEMINI_MODEL`, `VIRUSTOTAL_API_KEY`
5. **Deploy** y probar el recorrido: selector de empresa → subir `demo-files/factura_urgente.zip` → veredicto Bloquear → dashboard → SafeDocs.

## Notas

- Los archivos de `demo-files/` están pensados para la demo pública: inofensivos y con datos ficticios.
- La retención elimina archivos expirados en cada arranque en frío y desde el botón «Limpiar expirados» del dashboard.
