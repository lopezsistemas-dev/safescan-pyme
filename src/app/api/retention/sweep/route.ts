import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { sweepExpiredFiles } from "@/lib/retention";

/** Limpieza manual de archivos expirados (botón del dashboard). */
export async function POST() {
  const { error } = await requireSession();
  if (error) return error;

  const result = await sweepExpiredFiles();
  return NextResponse.json(result);
}
