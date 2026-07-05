import { NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { cleanPdfMetadata } from "@/lib/safedocs";
import { readPdfUploads, recordSafeDocsJob } from "@/lib/safedocs/api";

/**
 * SafeDocs: eliminar metadatos básicos del PDF (autor, título, software,
 * fechas), que a menudo revelan nombres de empleados o herramientas internas.
 */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return jsonError(400, "No se pudo leer el formulario.");

  const { files, error: fileError } = await readPdfUploads(formData, "files", { min: 1, max: 1 });
  if (fileError) return fileError;

  try {
    const output = await cleanPdfMetadata(ctx.tenant.id, files[0].buffer);
    return recordSafeDocsJob(ctx, "LIMPIAR_METADATOS", [files[0].name], output);
  } catch {
    return jsonError(422, "No se pudieron limpiar los metadatos. Comprueba que el PDF no esté dañado.");
  }
}
