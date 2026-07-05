import { NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { rotatePdf } from "@/lib/safedocs";
import { readPdfUploads, recordSafeDocsJob } from "@/lib/safedocs/api";

/** SafeDocs: rotar todas las páginas de un PDF (90/180/270º), en local. */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return jsonError(400, "No se pudo leer el formulario.");

  const angle = Number(formData.get("angle"));
  if (![90, 180, 270].includes(angle)) {
    return jsonError(400, "El ángulo debe ser 90, 180 o 270 grados.");
  }

  const { files, error: fileError } = await readPdfUploads(formData, "files", { min: 1, max: 1 });
  if (fileError) return fileError;

  try {
    const output = await rotatePdf(ctx.tenant.id, files[0].buffer, angle as 90 | 180 | 270);
    return recordSafeDocsJob(ctx, "ROTAR", [files[0].name], output);
  } catch {
    return jsonError(422, "No se pudo rotar el PDF. Comprueba que no esté dañado o protegido.");
  }
}
