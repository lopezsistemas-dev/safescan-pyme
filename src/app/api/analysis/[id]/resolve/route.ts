import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { jsonError, requireSession } from "@/lib/api-helpers";

/** Marca un análisis como revisado/resuelto por el responsable. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const analysis = await prisma.analysis.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    select: { id: true, resolved: true },
  });
  if (!analysis) return jsonError(404, "Análisis no encontrado.");

  const resolved = !analysis.resolved;
  await prisma.analysis.update({ where: { id }, data: { resolved } });

  await audit({
    tenantId: ctx.tenant.id,
    userId: ctx.user.id,
    analysisId: id,
    action: resolved ? "MARCADO_RESUELTO" : "MARCADO_PENDIENTE",
    details: `${ctx.user.name} marca el análisis como ${resolved ? "resuelto" : "pendiente"}.`,
  });

  return NextResponse.json({ ok: true, resolved });
}
