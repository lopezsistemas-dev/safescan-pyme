import { NextResponse } from "next/server";
import { getSessionContext, type SessionContext } from "@/lib/tenant";

/** Respuesta JSON de error con mensaje en castellano para la UI. */
export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
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
