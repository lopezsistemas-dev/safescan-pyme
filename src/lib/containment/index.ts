import { inspectZipEntries, type ArchiveInspection } from "./archive";
import { analyzeFileType, type FileTypeAnalysis } from "./filetype";
import {
  extractIndicatorsFromText,
  emptyExtraction,
  URGENCY_LEXICON,
  type IndicatorExtraction,
} from "./indicators";
import { extractSafeText, type PdfMeta } from "./text-extract";

export * from "./archive";
export * from "./filetype";
export * from "./indicators";
export * from "./quarantine";
export * from "./text-extract";

/**
 * Containment Engine: trata cada entrada como potencialmente hostil.
 * Para archivos: tipo real, doble extensión, indicadores del texto.
 * Para URLs y correos: indicadores y señales de phishing.
 * Nunca ejecuta, abre ni renderiza el contenido recibido.
 */

export interface ContainmentResult {
  fileType?: FileTypeAnalysis;
  /** Inspección de nombres de entradas si el archivo es un ZIP. */
  archive?: ArchiveInspection;
  extraction: IndicatorExtraction;
  textNote?: string;
  pdfMeta?: PdfMeta;
  /** Nombre del archivo contiene léxico de presión (p. ej. “urgente”). */
  urgencyInName: boolean;
}

function nameHasUrgency(name: string): boolean {
  const norm = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return URGENCY_LEXICON.some((w) => norm.includes(w.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

export async function containFile(
  buffer: Buffer,
  originalName: string,
  extraKeywords: string[] = []
): Promise<ContainmentResult> {
  const fileType = analyzeFileType(buffer, originalName);
  const { text, note, pdfMeta } = await extractSafeText(buffer, fileType.kind, fileType.ext);

  // Si es un ZIP, inspeccionar los nombres de sus entradas (sin descomprimir)
  const archive =
    fileType.kind === "zip" && fileType.isArchive ? inspectZipEntries(buffer) : undefined;

  // El nombre del archivo (y los nombres dentro del ZIP) también aportan señales
  const extraction = extractIndicatorsFromText(
    `${originalName}\n${archive?.entryNames.join("\n") ?? ""}\n${text}`,
    extraKeywords
  );

  return {
    fileType,
    archive,
    extraction,
    textNote: note,
    pdfMeta,
    urgencyInName: nameHasUrgency(originalName),
  };
}

export function containUrl(url: string, extraKeywords: string[] = []): ContainmentResult {
  const extraction = extractIndicatorsFromText(url, extraKeywords);
  return { extraction, urgencyInName: nameHasUrgency(url) };
}

export function containEmailText(text: string, extraKeywords: string[] = []): ContainmentResult {
  const extraction = extractIndicatorsFromText(text, extraKeywords);
  return { extraction, urgencyInName: false };
}

export function emptyContainment(): ContainmentResult {
  return { extraction: emptyExtraction(), urgencyInName: false };
}
