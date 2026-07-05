import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { deleteQuarantinedFile } from "@/lib/containment/quarantine";

/** Eliminación manual del archivo en cuarentena (botón del dashboard). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const analysis = await prisma.analysis.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    select: { id: true, filePath: true, fileDeleted: true, originalName: true },
  });
  if (!analysis) return jsonError(404, "Análisis no encontrado.");
  if (!analysis.filePath || analysis.fileDeleted) {
    return jsonError(409, "El archivo ya no está en cuarentena.");
  }

  await deleteQuarantinedFile(analysis.filePath);
  await prisma.analysis.update({
    where: { id },
    data: { fileDeleted: true },
  });

  await audit({
    tenantId: ctx.tenant.id,
    userId: ctx.user.id,
    analysisId: id,
    action: "ARCHIVO_ELIMINADO",
    details: `"${analysis.originalName ?? "archivo"}" eliminado manualmente de la cuarentena por ${ctx.user.name}.`,
  });

  return NextResponse.json({ ok: true });
}
