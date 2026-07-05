import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument, degrees } from "pdf-lib";

/**
 * SafeDocs: manipulación privada de documentos cotidianos.
 * Todas las operaciones se ejecutan localmente con pdf-lib: ningún
 * documento sale del servidor del MVP.
 *
 * "SafeScan protege documentos sospechosos. SafeDocs protege documentos cotidianos."
 */

export function safeDocsRoot(): string {
  return path.resolve(process.cwd(), "storage", "safedocs");
}

export interface SafeDocsOutput {
  /** Ruta relativa al proyecto (se persiste en BD). */
  relPath: string;
  fileName: string;
  size: number;
}

async function saveOutput(tenantId: string, bytes: Uint8Array, baseName: string): Promise<SafeDocsOutput> {
  const dir = path.join(safeDocsRoot(), tenantId);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${baseName}-${randomUUID().slice(0, 8)}.pdf`;
  const absPath = path.join(dir, fileName);
  await fs.writeFile(absPath, bytes, { mode: 0o600 });
  return {
    relPath: path.relative(process.cwd(), absPath),
    fileName,
    size: bytes.length,
  };
}

export async function readSafeDocsFile(relPath: string): Promise<Buffer | null> {
  try {
    const abs = path.resolve(process.cwd(), relPath);
    if (!abs.startsWith(safeDocsRoot() + path.sep)) return null;
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

export async function deleteSafeDocsFile(relPath: string): Promise<boolean> {
  try {
    const abs = path.resolve(process.cwd(), relPath);
    if (!abs.startsWith(safeDocsRoot() + path.sep)) return false;
    await fs.unlink(abs);
    return true;
  } catch {
    return false;
  }
}

/** Une varios PDFs en uno, en el orden recibido. */
export async function mergePdfs(tenantId: string, buffers: Buffer[]): Promise<SafeDocsOutput> {
  const merged = await PDFDocument.create();
  setSafeMetadata(merged);
  for (const buffer of buffers) {
    const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return saveOutput(tenantId, await merged.save(), "unido");
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
  return saveOutput(tenantId, await out.save(), "paginas");
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
  return saveOutput(tenantId, await doc.save(), "rotado");
}

/**
 * Elimina los metadatos básicos del documento (título, autor, empresa,
 * software de creación, fechas): información que a menudo revela nombres
 * de empleados o herramientas internas.
 */
export async function cleanPdfMetadata(tenantId: string, buffer: Buffer): Promise<SafeDocsOutput> {
  const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  setSafeMetadata(doc);
  return saveOutput(tenantId, await doc.save(), "limpio");
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
    // Se acota al rango válido ANTES de iterar: evita bloquear el event loop
    // con un rango enorme (p. ej. "1-999999999").
    const start = Math.max(1, parseInt(m[1], 10));
    const end = Math.min(totalPages, m[2] ? parseInt(m[2], 10) : start);
    for (let p = start; p <= end; p++) indices.add(p - 1);
  }
  return Array.from(indices).sort((a, b) => a - b);
}
