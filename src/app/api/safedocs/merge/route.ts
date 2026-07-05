import { NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { mergePdfs } from "@/lib/safedocs";
import { readPdfUploads, recordSafeDocsJob } from "@/lib/safedocs/api";

/** SafeDocs: unir varios PDFs en uno, en local. */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return jsonError(400, "No se pudo leer el formulario.");

  const { files, error: fileError } = await readPdfUploads(formData, "files", { min: 2, max: 10 });
  if (fileError) return fileError;

  try {
    const output = await mergePdfs(ctx.tenant.id, files.map((f) => f.buffer));
    return recordSafeDocsJob(ctx, "UNIR", files.map((f) => f.name), output);
  } catch {
    return jsonError(422, "No se pudieron unir los PDFs. Comprueba que no estén dañados o protegidos.");
  }
}
