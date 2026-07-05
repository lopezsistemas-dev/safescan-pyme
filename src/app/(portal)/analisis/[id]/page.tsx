import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionContext } from "@/lib/tenant";
import { AnalysisView } from "@/components/analysis-view";

export const dynamic = "force-dynamic";

/** Análisis en progreso / resultado. La vista cliente hace el polling. */
export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/seleccionar-empresa");

  const { id } = await params;
  const exists = await prisma.analysis.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    select: { id: true },
  });
  if (!exists) notFound();

  return <AnalysisView id={id} agentIsMock={env.agentIsMock} />;
}
