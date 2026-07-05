import { PDFDocument, degrees } from "pdf-lib";
import { saveSafeDocsOutput, type SafeDocsOutput } from "./storage";

export { readSafeDocsFile, deleteSafeDocsFile, type SafeDocsOutput } from "./storage";

/**
 * SafeDocs: manipulación privada de documentos cotidianos.
 * Todas las operaciones se ejecutan localmente con pdf-lib y el resultado
 * se guarda en la base de datos privada: ningún documento sale del entorno.
 *
 * "SafeScan protege documentos sospechosos. SafeDocs protege documentos cotidianos."
 */

/** Une varios PDFs en uno, en el orden recibido. */
export async function mergePdfs(tenantId: string, buffers: Buffer[]): Promise<SafeDocsOutput> {
  const merged = await PDFDocument.create();
  setSafeMetadata(merged);
  for (const buffer of buffers) {
    const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return saveSafeDocsOutput(tenantId, await merged.save(), "unido");
}

/**
 * Extrae un rango de páginas ("1-3,5") a un nuevo PDF.
 * Devuelve error si el rango no es válido.
 */
export async function splitPdf(
  tenantId: string,
  buffer: Buffer,
  ranges: string
): Promise<SafeDocsOutput> {
  const source = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  const total = source.getPageCount();
  const indices = parsePageRanges(ranges, total);
  if (indices.length === 0) {
    throw new Error(`El rango de páginas "${ranges}" no es válido para un PDF de ${total} páginas.`);
  }
  const out = await PDFDocument.create();
  setSafeMetadata(out);
  const pages = await out.copyPages(source, indices);
  for (const page of pages) out.addPage(page);
  return saveSafeDocsOutput(tenantId, await out.save(), "paginas");
}

/** Rota todas las páginas del PDF (90, 180 o 270 grados). */
export async function rotatePdf(
  tenantId: string,
  buffer: Buffer,
  angle: 90 | 180 | 270
): Promise<SafeDocsOutput> {
  const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  for (const page of doc.getPages()) {
    const current = page.getRotation().angle;
    page.setRotation(degrees(((current + angle) % 360) as 0 | 90 | 180 | 270));
  }
  return saveSafeDocsOutput(tenantId, await doc.save(), "rotado");
}

/**
 * Elimina los metadatos básicos del documento (título, autor, empresa,
 * software de creación, fechas): información que a menudo revela nombres
 * de empleados o herramientas internas.
 */
export async function cleanPdfMetadata(tenantId: string, buffer: Buffer): Promise<SafeDocsOutput> {
  const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  setSafeMetadata(doc);
  return saveSafeDocsOutput(tenantId, await doc.save(), "limpio");
}

function setSafeMetadata(doc: PDFDocument): void {
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("SafeDocs (SafeScan PYME)");
  doc.setCreator("SafeDocs (SafeScan PYME)");
  const epoch = new Date(0);
  doc.setCreationDate(epoch);
  doc.setModificationDate(epoch);
}

/** "1-3,5" → índices 0-based [0,1,2,4], acotados al total de páginas. */
export function parsePageRanges(ranges: string, totalPages: number): number[] {
  const indices = new Set<number>();
  for (const part of ranges.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(piece);
    if (!m) continue;
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    for (let p = start; p <= end; p++) {
      if (p >= 1 && p <= totalPages) indices.add(p - 1);
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}
