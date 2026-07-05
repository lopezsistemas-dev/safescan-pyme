import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { getExtension } from "@/lib/containment/filetype";
import { saveToQuarantine } from "@/lib/containment/quarantine";

/**
 * Subida segura de archivo: validación, cuarentena y registro.
 * El análisis se lanza después con POST /api/analysis/[id]/run.
 */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return jsonError(400, "No se pudo leer el formulario de subida.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError(400, "No se ha recibido ningún archivo.");
  }

  if (file.size > env.maxUploadBytes) {
    return jsonError(
      413,
      `El archivo supera el límite de ${env.MAX_UPLOAD_MB} MB configurado para el análisis.`
    );
  }

  const originalName = (file.name || "archivo").slice(0, 255);
  const ext = getExtension(originalName);
  if (!ext || !env.allowedExtensions.includes(ext)) {
    return jsonError(
      415,
      `La extensión ".${ext || "?"}" no está en la lista de tipos aceptados para análisis. ` +
        "Si necesitas analizarla, el responsable puede ampliarla en la configuración (ALLOWED_FILE_TYPES)."
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await saveToQuarantine(ctx.tenant.id, buffer);

  const analysis = await prisma.analysis.create({
    data: {
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      inputType: "FILE",
      originalName,
      filePath: saved.relPath,
      sha256: saved.sha256,
      mimeType: file.type || null,
      fileSize: saved.size,
      status: "RECIBIDO",
      progressStage: "Recibido en cuarentena",
      progressPct: 5,
      quarantined: true,
      mockMode: env.threatIntelIsMock,
    },
  });

  await audit({
    tenantId: ctx.tenant.id,
    userId: ctx.user.id,
    analysisId: analysis.id,
    action: "ARCHIVO_RECIBIDO",
    details: `"${originalName}" (${(saved.size / 1024).toFixed(1)} KB) recibido en cuarentena. SHA-256: ${saved.sha256.slice(0, 16)}…`,
  });

  return NextResponse.json({ analysisId: analysis.id });
}
