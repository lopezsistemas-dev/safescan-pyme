import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { jsonError, requireSession } from "@/lib/api-helpers";

const bodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(4, "La URL es demasiado corta.")
    .max(2000, "La URL es demasiado larga."),
});

/** Registro de una URL sospechosa para análisis. */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "URL no válida.");
  }

  // Normalizar: aceptar URLs pegadas sin protocolo
  let url = parsed.data.url;
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  try {
    new URL(url);
  } catch {
    return jsonError(400, "El texto pegado no parece una URL válida.");
  }

  const analysis = await prisma.analysis.create({
    data: {
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      inputType: "URL",
      inputValue: url,
      status: "RECIBIDO",
      progressStage: "URL recibida para análisis",
      progressPct: 5,
      mockMode: env.threatIntelIsMock,
    },
  });

  await audit({
    tenantId: ctx.tenant.id,
    userId: ctx.user.id,
    analysisId: analysis.id,
    action: "URL_RECIBIDA",
    details: `URL registrada para análisis: ${url.slice(0, 120)}`,
  });

  return NextResponse.json({ analysisId: analysis.id });
}
