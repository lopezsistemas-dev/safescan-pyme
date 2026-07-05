import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { jsonError, requireSession } from "@/lib/api-helpers";

const bodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(10, "Describe el correo con un poco más de detalle (mínimo 10 caracteres).")
    .max(20000, "El texto es demasiado largo; pega solo el contenido relevante."),
});

/** Registro de un correo sospechoso (texto pegado o descrito) para análisis. */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Texto no válido.");
  }

  const analysis = await prisma.analysis.create({
    data: {
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      inputType: "EMAIL_TEXT",
      inputValue: parsed.data.text,
      status: "RECIBIDO",
      progressStage: "Correo recibido para análisis",
      progressPct: 5,
      mockMode: env.threatIntelIsMock,
    },
  });

  await audit({
    tenantId: ctx.tenant.id,
    userId: ctx.user.id,
    analysisId: analysis.id,
    action: "CORREO_RECIBIDO",
    details: "Texto de correo sospechoso registrado para análisis (contenido no incluido en el log).",
  });

  return NextResponse.json({ analysisId: analysis.id });
}
