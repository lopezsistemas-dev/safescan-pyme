import { prisma } from "@/lib/db";

/**
 * Registro de auditoría: toda acción relevante queda trazada por tenant.
 * La trazabilidad es uno de los pilares de confianza del producto.
 */
export async function audit(entry: {
  tenantId: string;
  userId?: string | null;
  analysisId?: string | null;
  action: string;
  details: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId ?? null,
        analysisId: entry.analysisId ?? null,
        action: entry.action,
        details: entry.details,
      },
    });
  } catch (err) {
    // La auditoría nunca debe tumbar el flujo principal
    console.error("[audit] error registrando evento:", err);
  }
}
