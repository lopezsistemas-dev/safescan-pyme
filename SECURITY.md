# Política de seguridad

SafeScan PYME es un MVP académico desarrollado para los **Premios de la Cátedra de
Ciberseguridad a la Innovación en Ciberseguridad e IA** (Universidad de Málaga,
VirusTotal SLU / Google). Por defecto se ejecuta en modo *mock* determinista, con
empresas, usuarios y datos ficticios; no gestiona datos reales de personas.

## Cómo reportar una vulnerabilidad

Agradecemos la divulgación responsable. Por favor, **no abras una _issue_ pública**
con los detalles de una vulnerabilidad.

- **Preferido:** usa el reporte privado de GitHub — pestaña **Security →
  "Report a vulnerability"** de este repositorio (GitHub Private Vulnerability
  Reporting). El canal es privado entre quien reporta y el autor.
- **Alternativa:** abre una _issue_ mínima (sin detalles técnicos) solicitando un
  canal privado de contacto, y los detalles se intercambian de forma reservada.

Dado el carácter académico del proyecto, se responderá en un plazo razonable.

## Alcance

Dentro de alcance:

- El código de este repositorio (rama `main` = referencia local; `deploy/vercel`
  = demo pública desplegada).
- La demo pública: https://safescan-pyme.vercel.app

Fuera de alcance: la infraestructura de terceros (GitHub, Vercel, Supabase) y las
dependencias del proyecto, que deben reportarse a sus respectivos programas.

## Garantías de seguridad del propio proyecto

- **Privacidad por construcción:** los datos personales (DNI/NIE, IBAN, teléfonos,
  correos) se enmascaran antes de llegar a la capa de IA o de persistirse; el
  agente nunca recibe el contenido de los archivos.
- **Contención sin ejecución:** los archivos se analizan en cuarentena y nunca se
  abren ni se ejecutan; el tipo real se detecta por *magic bytes* y los ZIP se
  inspeccionan sin descomprimir.
- **Sin secretos en el repositorio:** las integraciones externas (Gemini,
  VirusTotal) están desactivadas por defecto; las claves reales se activan por
  variables de entorno y nunca se versionan.
