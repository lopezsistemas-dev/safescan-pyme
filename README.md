# SafeScan PYME

[![CI](https://github.com/lopezsistemas-dev/safescan-pyme/actions/workflows/ci.yml/badge.svg)](https://github.com/lopezsistemas-dev/safescan-pyme/actions/workflows/ci.yml)
&nbsp;[![Derechos reservados](https://img.shields.io/badge/derechos-reservados-critical)](LICENSE)
&nbsp;![Next.js 15](https://img.shields.io/badge/Next.js-15-black)
&nbsp;![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

**Agente privado de ciberseguridad para pymes y autónomos, impulsado por Gemini y VirusTotal/Google Threat Intelligence.**

**Demo pública en vivo:** https://safescan-pyme.vercel.app · **Repositorio:** https://github.com/lopezsistemas-dev/safescan-pyme

SafeScan PYME permite que cualquier empleado sin conocimientos técnicos pregunte *"¿puedo abrir esto?"* — un archivo, una URL o un correo sospechoso — y reciba una respuesta clara, segura y comprensible: **Abrir, Abrir con precaución, Bloquear, Escalar o Mantener en cuarentena**.

La idea central del producto:

> **La privacidad durante el análisis también es ciberseguridad.**

Cada archivo se trata como dos cosas a la vez: una **posible amenaza** (malware, phishing, macros, ejecutables camuflados) y un **posible activo sensible** (DNI, IBAN, teléfonos, datos de clientes o pacientes). Por eso no todos los archivos se analizan igual: un motor de políticas y privacidad decide el flujo adecuado para cada caso.

Proyecto presentado a los **Premios de la Cátedra de Ciberseguridad de la Universidad de Málaga** (UMA — VirusTotal/Google), como MVP funcional de desarrollo julio-agosto 2026.

---

## Ejecución rápida

Requisitos: Node.js 20 o superior.

```bash
npm install
npx prisma migrate dev   # crea la BD SQLite y ejecuta el seed automáticamente
npm run dev              # http://localhost:3000
```

No hace falta ninguna clave de API: **el MVP funciona completo en modo simulado (mock)**. Con claves reales de Gemini y/o VirusTotal, los conectores reales se activan solos (ver [Modos de funcionamiento](#modos-de-funcionamiento)).

Otros comandos:

```bash
npm test          # tests del Policy & Privacy Engine (vitest)
npm run lint      # eslint
npm run build     # build de producción
npm run db:reset  # reinicia la BD demo (migraciones + seed)
node scripts/make-demo-files.mjs  # regenera los archivos de demo-files/
```

---

## La demo en 3 minutos (guion para la comisión evaluadora)

1. **Landing** (`/`): propuesta de valor, arquitectura y roadmap.
2. **Selector de empresa** (`/seleccionar-empresa`): 3 pymes demo con su dominio privado simulado. Entrar como **Pablo Ruiz** (empleado de Asesoría López).
3. **Caso 1 — gestoría**: en el chat del agente, subir `demo-files/factura_urgente.zip` (clip 📎). El sistema detecta un ejecutable camuflado (`factura.pdf.exe`) **dentro** del ZIP leyendo solo los nombres de las entradas, sin descomprimir. Veredicto: **Bloquear**, cuarentena.
4. **Caso 2 — hotel**: cambiar a **Andrés Vega** (Hotel Málaga Centro) y subir `demo-files/reservas_agosto.xlsm`. Macros + datos de clientes → flujo **Private Scanning** (simulado) y veredicto **Escalar**.
5. **Caso 3 — clínica**: cambiar a **Javier Molina** (Clínica Sur) y subir `demo-files/documentacion_paciente.pdf`. DNI, IBAN y datos de salud (ficticios) → sensibilidad extrema → **análisis solo local + revisión humana**. El PDF nunca sale del entorno; los datos se muestran **enmascarados**.
6. **Caso 4 — autónomo**: pestaña «URL», pegar `http://pagos-verificacion-urgente.top/verificar?id=8123` → phishing probable → **Bloquear**. (También se puede pegar `demo-files/correo_phishing.txt` en la pestaña «Correo».)
7. **Caso 5 — SafeDocs**: unir `acta_reunion.pdf` + `presupuesto_marketing.pdf` sin usar ninguna web externa. Descargar el resultado.
8. **Dashboard** (`/dashboard`): historial completo, scores, veredictos, badges (Privado, Cuarentena, Private Scanning, Mock), informes, botones *resolver* / *eliminar archivo* / *limpiar expirados*, y registro de auditoría.
9. **Informe** (`/dashboard/informe/[id]`): doble informe (empleado + responsable) con trazabilidad completa del caso.
10. **Políticas** (`/politicas`): umbrales y reglas por empresa; estado del entorno (mock/real).

Todos los archivos de `demo-files/` son **inofensivos** y contienen únicamente datos ficticios.

---

## Arquitectura

```
Empleado ──▶ SafeScan Agent (chat) ──▶ Ingesta segura (validación + cuarentena)
                                              │
                                              ▼
                                   Containment Engine
                     hash SHA-256 · tipo real (magic bytes) · doble extensión
                     inspección de ZIP (solo nombres) · indicadores (URLs,
                     emails, teléfonos, IBAN, DNI/NIE, keywords) enmascarados
                                              │
                                              ▼
                                  Policy & Privacy Engine
                        threatScore (0-100)  +  sensitivityScore (0-100)
                                              │
              ┌─────────────┬─────────────┬───┴──────────┬──────────────┐
              ▼             ▼             ▼              ▼              ▼
         HASH_LOOKUP   URL_LOOKUP   PRIVATE_SCANNING  LOCAL_ONLY   HUMAN_REVIEW
                                    (simulado en MVP)                / QUARANTINE
              └─────────────┴─────────────┴──────────────┴──────────────┘
                                              │
                                              ▼
                    Threat Intelligence Layer (VirusTotal / mock)
                                              │
                                              ▼
                       AI Agent Layer (Gemini / mock) → veredicto e informes
                       ⚠ solo recibe metadatos, scores y señales enmascaradas
                                              │
                                              ▼
                    Informe empleado + Informe responsable + AuditLog
```

### Módulos

| Módulo | Ubicación | Qué hace |
|---|---|---|
| SafeScan Agent | `src/components/agent-chat.tsx`, `/api/chat` | Chat conversacional: archivo, URL o correo |
| Containment Engine | `src/lib/containment/` | Cuarentena, hash, tipo real, ZIP, indicadores enmascarados |
| Policy & Privacy Engine | `src/lib/policy/engine.ts` | Doble scoring y decisión de flujo (determinista y explicable) |
| Threat Intelligence | `src/lib/threat-intelligence/` | Interfaz + mock realista + conector VirusTotal API v3 |
| AI Agent | `src/lib/ai-agent/` | Interfaz + mock + conector Gemini (REST); informes |
| Pipeline | `src/lib/pipeline.ts` | Orquesta las etapas con progreso observable (timeline) |
| SafeDocs | `src/lib/safedocs/` | Unir/extraer/rotar/limpiar metadatos de PDF, 100 % local |
| Retención | `src/lib/retention.ts`, `src/instrumentation.ts` | Limpieza de expirados al arrancar + manual |
| Dashboard | `src/app/(portal)/dashboard/` | Historial, informes, cuarentena, auditoría |

### Estructura de carpetas

```
prisma/            schema + migraciones + seed (3 tenants, 5 casos demo)
demo-files/        archivos inofensivos para la demo (ver LEEME.md)
scripts/           generador de los archivos de demo
storage/           cuarentena y salidas SafeDocs (creado en runtime, no versionado)
src/
  app/             App Router: landing, selector, (portal)/agente|analisis|
                   safedocs|dashboard|politicas, api/*
  components/      UI propia (sin librerías de componentes externas)
  lib/             motores y servicios (lógica separada de la UI)
```

---

## Variables de entorno

Copia `.env.example` a `.env`. Valores por defecto pensados para la demo:

| Variable | Por defecto | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | *(vacío)* | Clave de Gemini. Vacío → agente mock |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo de Gemini a usar |
| `VIRUSTOTAL_API_KEY` | *(vacío)* | Clave de VirusTotal. Vacío → threat intel mock |
| `VIRUSTOTAL_PRIVATE_SCANNING_ENABLED` | `false` | Capacidad real de Private Scanning (requiere licencia y acuerdo) |
| `MOCK_SECURITY_ANALYSIS` | `true` | Fuerza el modo simulado aunque haya claves |
| `DATABASE_URL` | `file:./dev.db` | SQLite local (desarrollo) |
| `UPLOAD_DIR` | `./storage/quarantine` | Carpeta de cuarentena |
| `RETENTION_HOURS` | `24` | Horas de retención de archivos antes de su borrado |
| `MAX_UPLOAD_MB` | `25` | Límite de tamaño de subida |
| `ALLOWED_FILE_TYPES` | pdf, docx, xlsm, zip… | Extensiones aceptadas para análisis (los ejecutables se aceptan y se marcan como alto riesgo) |

## Modos de funcionamiento

### Modo mock (por defecto)

Sin claves, todo funciona: el mock de threat intelligence genera veredictos **realistas y deterministas** a partir de las señales locales (mismo archivo → mismo resultado), y el agente mock responde con plantillas guiadas por intención. Cada análisis queda marcado con el badge **Mock**.

### Modo Gemini real

1. Obtener una clave en Google AI Studio.
2. `GEMINI_API_KEY=...` en `.env` (y `GEMINI_MODEL` si se desea otro modelo).
3. Reiniciar el servidor.

El chat y los informes pasan a generarse con Gemini. **Minimización de datos garantizada por construcción**: el tipo `ReportInput` no tiene ningún campo para el contenido del archivo; Gemini solo recibe metadatos, puntuaciones, señales e indicadores ya enmascarados. Ante cualquier error de red, el sistema degrada automáticamente al mock sin romperse.

### Modo VirusTotal real

1. Obtener una clave de VirusTotal.
2. `VIRUSTOTAL_API_KEY=...` y `MOCK_SECURITY_ANALYSIS=false` en `.env`.
3. Reiniciar el servidor.

Se activan las consultas reales documentadas de la API v3: reputación de hash (`GET /files/{sha256}`) y de URL (`GET /urls/{id}`). Solo se envían **huellas y URLs**, nunca el contenido de los documentos. La API pública tiene límites y restricciones de uso comercial: un despliegue real operaría sobre la **Premium API como servicio gestionado autorizado**.

### Private Scanning

Private Scanning permite analizar archivos sin subirlos al corpus público, con visibilidad limitada a la organización y retención corta — el encaje perfecto para documentos sensibles de pyme. Es una capacidad **Premium bajo licencia y acuerdo con VirusTotal/Google**, por lo que en este MVP:

- el flujo `PRIVATE_SCANNING` existe de extremo a extremo (motor de políticas → pipeline → informes → badges);
- el resultado se **simula** y siempre se etiqueta: *"Private Scanning simulado para MVP académico. Conector preparado para integración autorizada."*;
- el conector (`src/lib/threat-intelligence/virustotal.ts`) define la interfaz y el punto de integración, pero **no llama a endpoints privados no autorizados** ni los inventa.

---

## Seguridad y privacidad del MVP

Decisiones implementadas:

- **Cuarentena real**: los archivos se guardan con nombre aleatorio y extensión neutra (`.quarantine`, permisos 0600); nunca se ejecutan, abren ni renderizan.
- **Tipo real por firma binaria**: la extensión declarada se contrasta con los magic bytes (un `.pdf` que empieza por `MZ` es un ejecutable).
- **Doble extensión** (`factura.pdf.exe`) detectada en el nombre y **dentro de los ZIP** (leyendo solo los nombres de las entradas, sin descomprimir).
- **Ejecutables bloqueados**: extensión ejecutable o ejecutable camuflado → cuarentena directa según política.
- **Enmascaramiento de PII**: DNI/NIE (con validación de letra de control), IBAN, teléfonos y emails se **persisten y muestran siempre enmascarados**.
- **Minimización hacia la IA**: el agente jamás recibe el archivo ni su contenido (garantizado por el tipo `ReportInput`).
- **Flujos por sensibilidad**: documentos muy sensibles → análisis exclusivamente local, sin consultas externas.
- **Trazabilidad**: cada acción (subida, análisis, veredicto, eliminación, retención, cambios de política) queda en `AuditLog` por empresa.
- **Retención configurable**: limpieza al arrancar el servidor + botón manual en el dashboard + eliminación manual por archivo.
- **Validación de entradas** con zod, límite de tamaño y lista de extensiones permitidas.
- **Separación por tenant** en todas las consultas y en el almacenamiento en disco.

## Limitaciones conocidas del MVP

- **Sin autenticación real**: el selector de empresa demo usa cookies simples; cualquier usuario puede entrar en cualquier tenant. La Fase 2 contempla autenticación real.
- **Sin sandbox dinámico**: no se ejecutan archivos (a propósito); el "análisis dinámico" se simula. Un producto real usaría el sandboxing de VirusTotal.
- **Extracción de texto limitada**: solo texto plano, HTML/CSV/EML y PDF (con `pdf-parse`). De Office y comprimidos se analizan metadatos, tipo real, nombres de entradas ZIP y hash, no su contenido.
- **Heurísticas de PII básicas**: regex + validación de letra de DNI; un producto real usaría DLP avanzado (roadmap Fase 3).
- **Private Scanning simulado** (ver sección anterior).
- **SQLite y almacenamiento local**: adecuados para el MVP; el despliegue multi-empresa real requeriría Postgres, almacenamiento cifrado y colas de trabajo.
- **El análisis de URL no visita la página**: se evalúan léxico, dominio y reputación; no hay renderizado ni seguimiento de redirecciones.

## Roadmap

**Fase MVP (julio-agosto)** — este repositorio: chat del agente, subida segura, cuarentena, doble scoring, flujos por política, threat intel mock/real por hash y URL, SafeDocs básico, dashboard, informes duales, auditoría y retención.

**Fase 2**: voz con Gemini Live API · integración real autorizada con Private Scanning · autenticación real · dominios personalizados reales · conectores de correo · alertas a responsables · reglas por departamento.

**Fase 3**: modelo MSSP/partner · multitenancy robusto · facturación · auditoría avanzada · DLP avanzado · CDR (desarme y reconstrucción de documentos) · OCR avanzado · integraciones con Google Workspace y Microsoft 365.

## Capturas sugeridas para la memoria

1. Landing con el claim "Pregunta antes de abrir."
2. Chat del agente con el saludo y las sugerencias rápidas.
3. Timeline de análisis en progreso.
4. Resultado del caso `factura_urgente.zip` (Bloquear, amenaza 100/100, indicador del ZIP).
5. Resultado del caso clínica (sensibilidad 90+, análisis solo local, PII enmascarada).
6. SafeDocs con un documento generado.
7. Dashboard del responsable con métricas y auditoría.
8. Informe dual empleado/responsable.

## Nota académica

MVP desarrollado para los Premios de la Cátedra de Ciberseguridad a la Innovación en Ciberseguridad e Inteligencia Artificial (Universidad de Málaga, en colaboración con VirusTotal SLU/Google). Los tres clientes, sus usuarios y todos los datos de `demo-files/` son ficticios. VirusTotal, Google y Gemini son marcas de sus respectivos titulares; su uso aquí es descriptivo, en el marco de la convocatoria.

## Propiedad intelectual

**Copyright © 2026 Daniel Manzano López. Todos los derechos reservados.**

Este repositorio es público **únicamente** para la evaluación de la candidatura y la demostración del proyecto: **no es código abierto**. La titularidad de los derechos de propiedad intelectual e industrial corresponde a su autor. Conforme a la resolución oficial de la convocatoria, la concesión del premio, la mentoría y el acceso a recursos **no implican cesión automática de derechos** a favor de la Universidad de Málaga, VirusTotal SLU, Google ni de ninguna otra entidad colaboradora.

Sin autorización previa y por escrito del autor no se permite usar, copiar, modificar, redistribuir ni explotar comercialmente el código o la idea. Se permite leer y revisar el proyecto con fines de evaluación y referencia académica, citando la autoría. Ver [`LICENSE`](LICENSE) para las condiciones completas.
