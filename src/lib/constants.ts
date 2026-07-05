/**
 * Constantes de dominio de SafeScan PYME.
 * Los valores se guardan como String en SQLite; este archivo es la
 * fuente de verdad de los valores válidos y sus etiquetas de UI.
 */

export const INPUT_TYPES = ["FILE", "URL", "EMAIL_TEXT", "SAFEDOCS"] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const FLOWS = [
  "HASH_LOOKUP",
  "URL_LOOKUP",
  "PRIVATE_SCANNING",
  "LOCAL_ONLY",
  "HUMAN_REVIEW",
  "QUARANTINE",
] as const;
export type RecommendedFlow = (typeof FLOWS)[number];

export const VERDICTS = [
  "ABRIR",
  "ABRIR_CON_PRECAUCION",
  "BLOQUEAR",
  "ESCALAR",
  "CUARENTENA",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export const INDICATOR_TYPES = [
  "URL",
  "DOMAIN",
  "EMAIL",
  "HASH",
  "PHONE",
  "IBAN",
  "DNI",
  "KEYWORD",
] as const;
export type IndicatorType = (typeof INDICATOR_TYPES)[number];

export const RISK_LEVELS = ["BAJO", "MEDIO", "ALTO"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const ANALYSIS_STATUS = ["RECIBIDO", "ANALIZANDO", "COMPLETADO", "ERROR"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUS)[number];

export const USER_ROLES = ["EMPLEADO", "RESPONSABLE"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SAFEDOCS_OPERATIONS = ["UNIR", "SEPARAR", "ROTAR", "LIMPIAR_METADATOS"] as const;
export type SafeDocsOperation = (typeof SAFEDOCS_OPERATIONS)[number];

// ── Etiquetas de UI ───────────────────────────────────────────────────────

export const VERDICT_LABELS: Record<Verdict, string> = {
  ABRIR: "Abrir",
  ABRIR_CON_PRECAUCION: "Abrir con precaución",
  BLOQUEAR: "Bloquear",
  ESCALAR: "Escalar al responsable",
  CUARENTENA: "Mantener en cuarentena",
};

export const FLOW_LABELS: Record<RecommendedFlow, string> = {
  HASH_LOOKUP: "Consulta por hash",
  URL_LOOKUP: "Análisis de URL",
  PRIVATE_SCANNING: "Private Scanning",
  LOCAL_ONLY: "Solo análisis local",
  HUMAN_REVIEW: "Revisión humana",
  QUARANTINE: "Cuarentena",
};

export const FLOW_DESCRIPTIONS: Record<RecommendedFlow, string> = {
  HASH_LOOKUP:
    "Se consulta la reputación de la huella digital (SHA-256) del archivo. El contenido nunca sale del entorno de la empresa.",
  URL_LOOKUP:
    "Se consulta la reputación de la URL y su dominio. No se envía ningún documento de la empresa.",
  PRIVATE_SCANNING:
    "Análisis privado: el documento se analiza sin subirse a ningún corpus público y sin compartirse con terceros. En el MVP este flujo se simula; el conector está preparado para la integración autorizada.",
  LOCAL_ONLY:
    "El documento es tan sensible que se analiza exclusivamente en local, sin ninguna consulta externa.",
  HUMAN_REVIEW:
    "El caso requiere criterio humano: se escala al responsable de la empresa con el informe técnico completo.",
  QUARANTINE:
    "El archivo queda bloqueado en cuarentena para impedir su apertura accidental, a la espera de decisión o eliminación.",
};

export const STATUS_LABELS: Record<AnalysisStatus, string> = {
  RECIBIDO: "Recibido",
  ANALIZANDO: "Analizando",
  COMPLETADO: "Completado",
  ERROR: "Error",
};

export const INDICATOR_TYPE_LABELS: Record<IndicatorType, string> = {
  URL: "URL",
  DOMAIN: "Dominio",
  EMAIL: "Email",
  HASH: "Hash",
  PHONE: "Teléfono",
  IBAN: "IBAN",
  DNI: "DNI/NIE",
  KEYWORD: "Señal",
};

export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  FILE: "Archivo",
  URL: "URL",
  EMAIL_TEXT: "Correo",
  SAFEDOCS: "SafeDocs",
};

export const SAFEDOCS_OPERATION_LABELS: Record<SafeDocsOperation, string> = {
  UNIR: "Unir PDFs",
  SEPARAR: "Extraer páginas",
  ROTAR: "Rotar PDF",
  LIMPIAR_METADATOS: "Limpiar metadatos",
};

// Nombre de las etapas del pipeline de análisis (timeline de la UI)
export const PIPELINE_STAGES = [
  { pct: 5, label: "Recibido en cuarentena" },
  { pct: 20, label: "Contención: hash y tipo real" },
  { pct: 40, label: "Extracción de indicadores" },
  { pct: 60, label: "Evaluación de política y privacidad" },
  { pct: 80, label: "Consulta de inteligencia de amenazas" },
  { pct: 95, label: "Generación de informes" },
  { pct: 100, label: "Análisis completado" },
] as const;
