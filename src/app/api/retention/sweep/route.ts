import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { sweepExpiredFiles } from "@/lib/retention";

/** Limpieza manual de archivos expirados (botón del dashboard). */
export async function POST() {
  const { ctx, error } = await requireSession();
  if (error) return error;

  // El barrido manual solo afecta a los datos del tenant de la sesión
  const result = await sweepExpiredFiles(ctx.tenant.id);
  return NextResponse.json(result);
}
