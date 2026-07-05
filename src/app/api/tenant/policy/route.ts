import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { jsonError, requireSession } from "@/lib/api-helpers";

const bodySchema = z.object({
  umbralAmenaza: z.number().int().min(0).max(100),
  umbralSensibilidad: z.number().int().min(0).max(100),
  bloquearEjecutables: z.boolean(),
  privateScanningPreferido: z.boolean(),
  notificarResponsable: z.boolean(),
  palabrasSensiblesExtra: z.array(z.string().trim().min(1).max(40)).max(20),
});

/** Actualización de la política demo de la empresa. */
export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Política no válida.");

  await prisma.tenant.update({
    where: { id: ctx.tenant.id },
    data: { policy: JSON.stringify(parsed.data) },
  });

  await audit({
    tenantId: ctx.tenant.id,
    userId: ctx.user.id,
    action: "POLITICA_ACTUALIZADA",
    details: `${ctx.user.name} actualiza la política (amenaza ≥${parsed.data.umbralAmenaza}, sensibilidad ≥${parsed.data.umbralSensibilidad}).`,
  });

  return NextResponse.json({ ok: true });
}
