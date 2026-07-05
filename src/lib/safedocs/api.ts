import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { jsonError } from "@/lib/api-helpers";
import type { SessionContext } from "@/lib/tenant";
import type { SafeDocsOperation } from "@/lib/constants";
import type { SafeDocsOutput } from "./index";

/**
 * Utilidades comunes de las rutas SafeDocs: validación de PDFs subidos
 * y registro del trabajo + auditoría.
 */

const PDF_MAGIC = Buffer.from("%PDF");

export interface UploadedPdf {
  name: string;
  buffer: Buffer;
}

/** Lee y valida los PDFs de un FormData (solo PDFs reales, con límite de tamaño). */
export async function readPdfUploads(
  formData: FormData,
  field: string,
  { min, max }: { min: number; max: number }
): Promise<{ files: UploadedPdf[]; error: NextResponse | null }> {
  const entries = formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);

  if (entries.length < min) {
    return {
      files: [],
      error: jsonError(400, min > 1 ? `Selecciona al menos ${min} PDFs.` : "Selecciona un PDF."),
    };
  }
  if (entries.length > max) {
    return { files: [], error: jsonError(400, `Máximo ${max} PDFs por operación.`) };
  }

  // Tope agregado de memoria: la suma de todos los PDF no puede exceder 3×
  // el límite por archivo, aunque cada uno individualmente lo respete.
  const aggregateLimit = env.maxUploadBytes * 3;
  let aggregate = 0;

  const files: UploadedPdf[] = [];
  for (const file of entries) {
    if (file.size > env.maxUploadBytes) {
      return {
        files: [],
        error: jsonError(413, `"${file.name}" supera el límite de ${env.MAX_UPLOAD_MB} MB.`),
      };
    }
    aggregate += file.size;
    if (aggregate > aggregateLimit) {
      return {
        files: [],
        error: jsonError(413, "El tamaño total de los documentos supera el límite permitido."),
      };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.subarray(0, 4).equals(PDF_MAGIC)) {
      return {
        files: [],
        error: jsonError(415, `"${file.name}" no es un PDF válido. SafeDocs solo trabaja con PDFs.`),
      };
    }
    files.push({ name: (file.name || "documento.pdf").slice(0, 255), buffer });
  }
  return { files, error: null };
}

/** Registra el trabajo SafeDocs y su evento de auditoría; devuelve la respuesta. */
export async function recordSafeDocsJob(
  ctx: SessionContext,
  operation: SafeDocsOperation,
  inputNames: string[],
  output: SafeDocsOutput
): Promise<NextResponse> {
  const job = await prisma.safeDocsJob.create({
    data: {
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      operation,
      inputFiles: JSON.stringify(inputNames),
      outputFile: output.relPath,
      status: "COMPLETADO",
    },
  });

  await audit({
    tenantId: ctx.tenant.id,
    userId: ctx.user.id,
    action: `SAFEDOCS_${operation}`,
    details: `${inputNames.join(", ")} → ${output.fileName} (procesado localmente, sin servicios externos).`,
  });

  return NextResponse.json({
    jobId: job.id,
    fileName: output.fileName,
    size: output.size,
    downloadUrl: `/api/safedocs/download/${job.id}`,
  });
}
