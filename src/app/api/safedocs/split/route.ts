import { NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { splitPdf } from "@/lib/safedocs";
import { readPdfUploads, recordSafeDocsJob } from "@/lib/safedocs/api";

/** SafeDocs: extraer un rango de páginas ("1-3,5") a un nuevo PDF, en local. */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return jsonError(400, "No se pudo leer el formulario.");

  const ranges = String(formData.get("ranges") ?? "").trim();
  if (!ranges) return jsonError(400, "Indica las páginas a extraer (por ejemplo: 1-3,5).");

  const { files, error: fileError } = await readPdfUploads(formData, "files", { min: 1, max: 1 });
  if (fileError) return fileError;

  try {
    const output = await splitPdf(ctx.tenant.id, files[0].buffer, ranges);
    return recordSafeDocsJob(ctx, "SEPARAR", [files[0].name], output);
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("rango")
        ? err.message
        : "No se pudo procesar el PDF. Comprueba el rango de páginas y que el archivo no esté dañado.";
    return jsonError(422, message);
  }
}
