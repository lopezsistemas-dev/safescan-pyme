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
    select: { id: true, status: true, updatedAt: true },
  });
  if (!analysis) return jsonError(404, "Análisis no encontrado.");

  // Un análisis ya completado NO se relanza: es idempotente. Evita que volver a
  // abrir la página de resultado (historial, atrás del navegador) recompute y
  // sobrescriba un veredicto ya emitido, sobre todo si el archivo ya se purgó.
  if (analysis.status === "COMPLETADO") {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  // Un análisis en curso reciente no se relanza; pero si lleva colgado en
  // ANALIZANDO más de 2 minutos (proceso muerto, timeout de plataforma…) se
  // considera zombi y se permite reclamarlo, para no bloquearlo para siempre.
  const STALE_MS = 2 * 60_000;
  const isStale = Date.now() - new Date(analysis.updatedAt).getTime() > STALE_MS;
  const reclaimableZombie = analysis.status === "ANALIZANDO" && isStale;
  if (analysis.status === "ANALIZANDO" && !isStale) {
    return jsonError(409, "El análisis ya está en curso.");
  }

  // Lock atómico: solo un ejecutor puede pasar de RECIBIDO/ERROR (o de un zombi
  // ANALIZANDO viejo) a ANALIZANDO. Un COMPLETADO nunca llega hasta aquí.
  const claim = await prisma.analysis.updateMany({
    where: {
      id,
      tenantId: ctx.tenant.id,
      ...(reclaimableZombie
        ? {}
        : { status: { in: ["RECIBIDO", "ERROR"] } }),
    },
    data: { status: "ANALIZANDO", progressStage: "Recibido en cuarentena", progressPct: 5 },
  });
  if (claim.count === 0) {
    return jsonError(409, "El análisis ya está en curso.");
  }

  try {
    await runAnalysisPipeline(id);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError(500, "El análisis falló. Revisa el detalle en el dashboard.");
  }
}
