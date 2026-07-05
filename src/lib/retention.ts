import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { deleteQuarantinedFile } from "@/lib/containment/quarantine";
import { deleteSafeDocsFile } from "@/lib/safedocs";

/**
 * Retención configurable (RETENTION_HOURS): pasado el plazo se eliminan los
 * archivos en cuarentena, los documentos generados por SafeDocs y el texto
 * libre (correo/URL) que pudiera contener datos personales.
 *
 * Se ejecuta al arrancar el servidor (instrumentation.ts, barrido global) y
 * desde el dashboard (barrido acotado al tenant de la sesión).
 *
 * @param tenantId si se indica, el barrido se limita a ese tenant.
 */
export async function sweepExpiredFiles(
  tenantId?: string
): Promise<{ quarantine: number; safedocs: number; inputs: number }> {
  const cutoff = new Date(Date.now() - env.RETENTION_HOURS * 3600_000);
  const scope = tenantId ? { tenantId } : {};
  let quarantineDeleted = 0;
  let safeDocsDeleted = 0;
  let inputsPurged = 0;

  // 1) Archivos en cuarentena vencidos
  const expiredAnalyses = await prisma.analysis.findMany({
    where: { ...scope, filePath: { not: null }, fileDeleted: false, createdAt: { lt: cutoff } },
    select: { id: true, tenantId: true, filePath: true, originalName: true },
  });
  for (const analysis of expiredAnalyses) {
    if (analysis.filePath) await deleteQuarantinedFile(analysis.filePath);
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: { fileDeleted: true, filePath: null },
    });
    await audit({
      tenantId: analysis.tenantId,
      analysisId: analysis.id,
      action: "RETENCION_APLICADA",
      details: `Archivo "${analysis.originalName ?? "sin nombre"}" eliminado de cuarentena tras ${env.RETENTION_HOURS} h de retención.`,
    });
    quarantineDeleted++;
  }

  // 2) Texto libre (correo/URL) vencido: se purga el inputValue restante
  const expiredInputs = await prisma.analysis.findMany({
    where: {
      ...scope,
      inputType: { in: ["URL", "EMAIL_TEXT"] },
      inputValue: { not: null },
      createdAt: { lt: cutoff },
    },
    select: { id: true, tenantId: true },
  });
  for (const analysis of expiredInputs) {
    await prisma.analysis.update({ where: { id: analysis.id }, data: { inputValue: null } });
    await audit({
      tenantId: analysis.tenantId,
      analysisId: analysis.id,
      action: "RETENCION_APLICADA",
      details: `Texto analizado (correo/URL) purgado tras ${env.RETENTION_HOURS} h de retención.`,
    });
    inputsPurged++;
  }

  // 3) Documentos generados por SafeDocs vencidos
  const expiredJobs = await prisma.safeDocsJob.findMany({
    where: { ...scope, outputFile: { not: null }, createdAt: { lt: cutoff } },
    select: { id: true, tenantId: true, outputFile: true, operation: true },
  });
  for (const job of expiredJobs) {
    if (job.outputFile) await deleteSafeDocsFile(job.outputFile);
    await prisma.safeDocsJob.update({ where: { id: job.id }, data: { outputFile: null } });
    await audit({
      tenantId: job.tenantId,
      action: "RETENCION_APLICADA",
      details: `Documento SafeDocs (${job.operation}) eliminado tras ${env.RETENTION_HOURS} h de retención.`,
    });
    safeDocsDeleted++;
  }

  return { quarantine: quarantineDeleted, safedocs: safeDocsDeleted, inputs: inputsPurged };
}
