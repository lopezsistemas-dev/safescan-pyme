import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { readSafeDocsFile } from "@/lib/safedocs";

/** Descarga del documento generado por SafeDocs (con ámbito de tenant). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const job = await prisma.safeDocsJob.findFirst({
    where: { id, tenantId: ctx.tenant.id },
  });
  if (!job) return jsonError(404, "Trabajo SafeDocs no encontrado.");
  if (!job.outputFile) {
    return jsonError(410, "El documento ya no está disponible (eliminado por la política de retención).");
  }

  const stored = await readSafeDocsFile(job.outputFile);
  if (!stored) return jsonError(410, "El documento ya no está disponible.");

  const { buffer, fileName } = stored;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
