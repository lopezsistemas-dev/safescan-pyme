import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { deleteQuarantinedFile } from "@/lib/containment/quarantine";
import { deleteSafeDocsFile } from "@/lib/safedocs";

/**
 * Retención configurable (RETENTION_HOURS): los archivos en cuarentena y
 * los documentos generados por SafeDocs se eliminan pasado el plazo.
 * Se ejecuta al arrancar el servidor (instrumentation.ts) y puede
 * lanzarse manualmente desde el dashboard.
 */
export async function sweepExpiredFiles(): Promise<{ quarantine: number; safedocs: number }> {
  const cutoff = new Date(Date.now() - env.RETENTION_HOURS * 3600_000);
  let quarantineDeleted = 0;
  let safeDocsDeleted = 0;

  const expiredAnalyses = await prisma.analysis.findMany({
    where: {
      filePath: { not: null },
      fileDeleted: false,
      createdAt: { lt: cutoff },
    },
    select: { id: true, tenantId: true, filePath: true, originalName: true },
  });

  for (const analysis of expiredAnalyses) {
    if (analysis.filePath) await deleteQuarantinedFile(analysis.filePath);
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: { fileDeleted: true },
    });
    await audit({
      tenantId: analysis.tenantId,
      analysisId: analysis.id,
      action: "RETENCION_APLICADA",
      details: `Archivo "${analysis.originalName ?? "sin nombre"}" eliminado de cuarentena tras ${env.RETENTION_HOURS} h de retención.`,
    });
    quarantineDeleted++;
  }

  const expiredJobs = await prisma.safeDocsJob.findMany({
    where: { outputFile: { not: null }, createdAt: { lt: cutoff } },
    select: { id: true, tenantId: true, outputFile: true, operation: true },
  });

  for (const job of expiredJobs) {
    if (job.outputFile) await deleteSafeDocsFile(job.outputFile);
    await prisma.safeDocsJob.update({
      where: { id: job.id },
      data: { outputFile: null },
    });
    await audit({
      tenantId: job.tenantId,
      action: "RETENCION_APLICADA",
      details: `Documento SafeDocs (${job.operation}) eliminado tras ${env.RETENTION_HOURS} h de retención.`,
    });
    safeDocsDeleted++;
  }

  return { quarantine: quarantineDeleted, safedocs: safeDocsDeleted };
}
