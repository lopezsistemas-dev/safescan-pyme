import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Cuarentena respaldada en base de datos (variante para despliegue
 * serverless): los archivos se guardan como bytes en la tabla StoredFile,
 * privada por definición — nunca en disco efímero ni en almacenamiento
 * público. Nunca se ejecuta ni se abre ningún archivo recibido.
 *
 * Las referencias se persisten como "db:<id>" en Analysis.filePath,
 * manteniendo la misma interfaz que la variante local en disco (rama main).
 */

const DB_PREFIX = "db:";

export function sha256Of(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export interface QuarantinedFile {
  /** Referencia persistida en BD ("db:<id>"). */
  relPath: string;
  sha256: string;
  size: number;
}

export async function saveToQuarantine(tenantId: string, buffer: Buffer): Promise<QuarantinedFile> {
  const row = await prisma.storedFile.create({
    data: { tenantId, scope: "QUARANTINE", data: new Uint8Array(buffer) },
    select: { id: true },
  });
  return {
    relPath: `${DB_PREFIX}${row.id}`,
    sha256: sha256Of(buffer),
    size: buffer.length,
  };
}

export async function readQuarantinedFile(relPath: string): Promise<Buffer | null> {
  if (!relPath.startsWith(DB_PREFIX)) return null;
  const row = await prisma.storedFile.findFirst({
    where: { id: relPath.slice(DB_PREFIX.length), scope: "QUARANTINE" },
    select: { data: true },
  });
  return row ? Buffer.from(row.data) : null;
}

export async function deleteQuarantinedFile(relPath: string): Promise<boolean> {
  if (!relPath.startsWith(DB_PREFIX)) return false;
  const result = await prisma.storedFile.deleteMany({
    where: { id: relPath.slice(DB_PREFIX.length), scope: "QUARANTINE" },
  });
  return result.count > 0;
}
