import { z } from "zod";

/**
 * Variables de entorno validadas. Sin claves reales, todo funciona en mock:
 * el objetivo es que el MVP nunca se rompa por configuración incompleta.
 */

const boolFromString = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim().toLowerCase() === "true");

const envSchema = z.object({
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-2.0-flash"),
  VIRUSTOTAL_API_KEY: z.string().optional().default(""),
  VIRUSTOTAL_PRIVATE_SCANNING_ENABLED: boolFromString,
  MOCK_SECURITY_ANALYSIS: z
    .string()
    .optional()
    .transform((v) => (v ?? "true").trim().toLowerCase() !== "false"),
  UPLOAD_DIR: z.string().optional().default("./storage/quarantine"),
  RETENTION_HOURS: z.coerce.number().positive().optional().default(24),
  MAX_UPLOAD_MB: z.coerce.number().positive().optional().default(25),
  ALLOWED_FILE_TYPES: z
    .string()
    .optional()
    .default(
      "pdf,doc,docx,docm,xls,xlsx,xlsm,ppt,pptx,zip,rar,7z,txt,csv,html,htm,eml,rtf,odt,ods,jpg,jpeg,png,exe,msi,bat,cmd,js,vbs,scr,com,jar"
    ),
});

const parsed = envSchema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY,
  VIRUSTOTAL_PRIVATE_SCANNING_ENABLED: process.env.VIRUSTOTAL_PRIVATE_SCANNING_ENABLED,
  MOCK_SECURITY_ANALYSIS: process.env.MOCK_SECURITY_ANALYSIS,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  RETENTION_HOURS: process.env.RETENTION_HOURS,
  MAX_UPLOAD_MB: process.env.MAX_UPLOAD_MB,
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES,
});

export const env = {
  ...parsed,
  /** Extensiones aceptadas para subida (en minúsculas, sin punto). */
  allowedExtensions: parsed.ALLOWED_FILE_TYPES.split(",")
    .map((e) => e.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean),
  /** Límite de subida en bytes. */
  maxUploadBytes: Math.floor(parsed.MAX_UPLOAD_MB * 1024 * 1024),
  /** true si la capa de threat intelligence debe usar el proveedor mock. */
  threatIntelIsMock: parsed.MOCK_SECURITY_ANALYSIS || !parsed.VIRUSTOTAL_API_KEY,
  /** true si el agente conversacional debe usar el proveedor mock. */
  agentIsMock: !parsed.GEMINI_API_KEY,
};

export type Env = typeof env;
