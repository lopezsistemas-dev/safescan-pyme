import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { jsonError } from "@/lib/api-helpers";
import { TENANT_COOKIE, USER_COOKIE } from "@/lib/tenant";

const bodySchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
});

/** Selección de empresa y usuario demo (multicliente simulado). */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Petición no válida.");

  const { tenantId, userId } = parsed.data;
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    include: { tenant: true },
  });
  if (!user) return jsonError(404, "Empresa o usuario demo no encontrado.");

  const res = NextResponse.json({
    ok: true,
    tenant: user.tenant.name,
    user: user.name,
  });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
  res.cookies.set(TENANT_COOKIE, tenantId, cookieOptions);
  res.cookies.set(USER_COOKIE, userId, cookieOptions);

  await audit({
    tenantId,
    userId,
    action: "SESION_INICIADA",
    details: `${user.name} (${user.role}) accede al portal ${user.tenant.domain}.`,
  });

  return res;
}
