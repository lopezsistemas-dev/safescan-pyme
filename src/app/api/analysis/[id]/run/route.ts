import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { runAnalysisPipeline } from "@/lib/pipeline";

// El pipeline mantiene la petición abierta mientras avanza (serverless)
export const maxDuration = 60;

/**
 * Ejecuta el pipeline de análisis completo sobre un análisis registrado.
 * La petición se mantiene abierta mientras avanza; la UI hace polling en
 * paralelo a GET /api/analysis/[id] para pintar el timeline.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const analysis = await prisma.analysis.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    select: { id: true, status: true },
  });
  if (!analysis) return jsonError(404, "Análisis no encontrado.");
  if (analysis.status === "ANALIZANDO") {
    return jsonError(409, "El análisis ya está en curso.");
  }

  try {
    await runAnalysisPipeline(id);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError(500, "El análisis falló. Revisa el detalle en el dashboard.");
  }
}
