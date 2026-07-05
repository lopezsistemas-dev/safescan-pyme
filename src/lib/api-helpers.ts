import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSessionContext, type SessionContext } from "@/lib/tenant";

/** Respuesta JSON de error con mensaje en castellano para la UI. */
export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Rechazo temprano por Content-Length: evita bufferizar en memoria cuerpos
 * que ya se sabe que superan el límite (se acepta un 10% de margen por el
 * overhead de multipart). Devuelve un 413 listo para retornar, o null.
 */
export function rejectOversizedBody(req: NextRequest): NextResponse | null {
  const len = Number(req.headers.get("content-length"));
  if (Number.isFinite(len) && len > env.maxUploadBytes * 1.1) {
    return jsonError(413, `El envío supera el límite de ${env.MAX_UPLOAD_MB} MB.`);
  }
  return null;
}

/**
 * Exige una sesión demo válida (empresa + usuario seleccionados).
 * Devuelve el contexto o una respuesta 401 lista para retornar.
 */
export async function requireSession(): Promise<
  { ctx: SessionContext; error: null } | { ctx: null; error: NextResponse }
> {
  const ctx = await getSessionContext();
  if (!ctx) {
    return {
      ctx: null,
      error: jsonError(401, "Selecciona primero una empresa demo para usar SafeScan."),
    };
  }
  return { ctx, error: null };
}
