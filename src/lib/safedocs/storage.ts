import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Almacenamiento SafeDocs respaldado en base de datos (variante serverless).
 * Los documentos generados se guardan como bytes privados en StoredFile y se
 * referencian como "db:<id>" en SafeDocsJob.outputFile.
 */

const DB_PREFIX = "db:";

export interface SafeDocsOutput {
  /** Referencia persistida en BD ("db:<id>"). */
  relPath: string;
  fileName: string;
  size: number;
}

export async function saveSafeDocsOutput(
  tenantId: string,
  bytes: Uint8Array,
  baseName: string
): Promise<SafeDocsOutput> {
  const fileName = `${baseName}-${randomUUID().slice(0, 8)}.pdf`;
  const row = await prisma.storedFile.create({
    data: { tenantId, scope: "SAFEDOCS", name: fileName, data: new Uint8Array(bytes) },
    select: { id: true },
  });
  return { relPath: `${DB_PREFIX}${row.id}`, fileName, size: bytes.length };
}

export async function readSafeDocsFile(
  relPath: string
): Promise<{ buffer: Buffer; fileName: string } | null> {
  if (!relPath.startsWith(DB_PREFIX)) return null;
  const row = await prisma.storedFile.findFirst({
    where: { id: relPath.slice(DB_PREFIX.length), scope: "SAFEDOCS" },
    select: { data: true, name: true },
  });
  if (!row) return null;
  return { buffer: Buffer.from(row.data), fileName: row.name ?? "safedocs.pdf" };
}

export async function deleteSafeDocsFile(relPath: string): Promise<boolean> {
  if (!relPath.startsWith(DB_PREFIX)) return false;
  const result = await prisma.storedFile.deleteMany({
    where: { id: relPath.slice(DB_PREFIX.length), scope: "SAFEDOCS" },
  });
  return result.count > 0;
}
