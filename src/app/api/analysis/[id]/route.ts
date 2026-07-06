import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { maskPiiInText } from "@/lib/containment/indicators";

/** Estado y resultado de un análisis (la UI hace polling durante el pipeline). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const analysis = await prisma.analysis.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    include: { indicators: true, user: { select: { name: true, role: true } } },
  });
  if (!analysis) return jsonError(404, "Análisis no encontrado.");

  // Privacidad: el texto libre (correo/URL) se persiste enmascarado al COMPLETAR,
  // pero durante el pipeline sigue en claro en BD. Se enmascara también aquí para
  // que la vista en vivo nunca reciba PII sin enmascarar.
  const safe =
    analysis.inputType !== "FILE" && analysis.inputValue
      ? { ...analysis, inputValue: maskPiiInText(analysis.inputValue) }
      : analysis;

  return NextResponse.json({ analysis: safe });
}
