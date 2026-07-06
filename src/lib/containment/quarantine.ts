import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Cuarentena: los archivos se guardan con nombre aleatorio y extensión
 * neutra (.quarantine) para impedir su apertura o ejecución accidental.
 * Nunca se ejecuta ni se abre ningún archivo recibido.
 */

export function quarantineRoot(): string {
  return path.resolve(process.cwd(), env.UPLOAD_DIR);
}

export function sha256Of(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export interface QuarantinedFile {
  /** Ruta relativa al proyecto (se persiste en BD). */
  relPath: string;
  sha256: string;
  size: number;
}

export async function saveToQuarantine(tenantId: string, buffer: Buffer): Promise<QuarantinedFile> {
  const dir = path.join(quarantineRoot(), tenantId);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.quarantine`;
  const absPath = path.join(dir, filename);
  await fs.writeFile(absPath, buffer, { mode: 0o600 });
  return {
    relPath: path.relative(process.cwd(), absPath),
    sha256: sha256Of(buffer),
    size: buffer.length,
  };
}

export async function readQuarantinedFile(relPath: string): Promise<Buffer | null> {
  try {
    const abs = path.resolve(process.cwd(), relPath);
    // Nunca leer fuera del directorio de cuarentena
    if (!abs.startsWith(quarantineRoot() + path.sep)) return null;
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

export async function deleteQuarantinedFile(relPath: string): Promise<boolean> {
  try {
    const abs = path.resolve(process.cwd(), relPath);
    if (!abs.startsWith(quarantineRoot() + path.sep)) return false;
    await fs.unlink(abs);
    return true;
  } catch {
    return false;
  }
}
