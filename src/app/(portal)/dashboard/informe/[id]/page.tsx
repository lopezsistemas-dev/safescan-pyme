import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, ScrollText, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionContext } from "@/lib/tenant";
import {
  INDICATOR_TYPE_LABELS,
  INPUT_TYPE_LABELS,
  type IndicatorType,
  type InputType,
  type Verdict,
} from "@/lib/constants";
import { maskPiiInText } from "@/lib/containment/indicators";
import { Card, ReportMarkdown, RiskBadge, ScoreBar, formatBytes, formatDate } from "@/components/ui";
import { AnalysisBadges, VerdictBanner } from "@/components/analysis-ui";

export const dynamic = "force-dynamic";

/** Detalle de informe: versión empleado + versión responsable + trazabilidad. */
export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/seleccionar-empresa");

  const { id } = await params;
  const analysis = await prisma.analysis.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    include: {
      indicators: true,
      user: { select: { name: true, role: true } },
      auditLogs: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!analysis) notFound();

  let policyReason: string | undefined;
  try {
    policyReason = (JSON.parse(analysis.policyJson ?? "{}") as { reason?: string }).reason;
  } catch {
    policyReason = undefined;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al dashboard
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold break-all text-slate-900">
            {analysis.originalName ?? (analysis.inputValue ? maskPiiInText(analysis.inputValue) : "Análisis")}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>{INPUT_TYPE_LABELS[analysis.inputType as InputType] ?? analysis.inputType}</span>
            <span className="flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" /> {analysis.user.name}
            </span>
            <span>{formatDate(analysis.createdAt)}</span>
            {analysis.fileSize ? <span>{formatBytes(analysis.fileSize)}</span> : null}
          </p>
        </div>
        <AnalysisBadges
          mockMode={analysis.mockMode}
          privateScanningUsed={analysis.privateScanningUsed}
          quarantined={analysis.quarantined && !analysis.fileDeleted}
          providerUsed={analysis.providerUsed}
          agentIsMock={env.agentIsMock}
        />
      </div>

      {analysis.finalVerdict ? (
        <VerdictBanner verdict={analysis.finalVerdict as Verdict} detail={policyReason} />
      ) : null}

      <Card className="mt-4 p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <ScoreBar label="Riesgo de amenaza" value={analysis.threatScore ?? 0} />
          <ScoreBar label="Sensibilidad del contenido" value={analysis.sensitivityScore ?? 0} />
        </div>
        {analysis.sha256 ? (
          <p className="mt-4 border-t border-slate-100 pt-3 font-mono text-xs break-all text-slate-500">
            SHA-256: {analysis.sha256}
          </p>
        ) : null}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="border-brand-200 p-5">
          <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-slate-900">
            <ClipboardList className="h-4.5 w-4.5 text-brand-600" /> Informe para el empleado
          </h2>
          {analysis.employeeReport ? (
            <ReportMarkdown text={analysis.employeeReport} />
          ) : (
            <p className="text-sm text-slate-400">Informe no disponible.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-slate-900">
            <ClipboardList className="h-4.5 w-4.5 text-slate-500" /> Informe para el responsable
          </h2>
          {analysis.adminReport ? (
            <ReportMarkdown text={analysis.adminReport} />
          ) : (
            <p className="text-sm text-slate-400">Informe no disponible.</p>
          )}
        </Card>
      </div>

      {analysis.indicators.length > 0 ? (
        <Card className="mt-4 p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Indicadores</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-400 uppercase">
                  <th className="pr-4 pb-2 font-medium">Tipo</th>
                  <th className="pr-4 pb-2 font-medium">Valor</th>
                  <th className="pb-2 font-medium">Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {analysis.indicators.map((indicator) => (
                  <tr key={indicator.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-500">
                      {INDICATOR_TYPE_LABELS[indicator.type as IndicatorType] ?? indicator.type}
                    </td>
                    <td className="py-2 pr-4 break-all text-slate-700">{indicator.value}</td>
                    <td className="py-2">
                      <RiskBadge risk={indicator.risk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="mt-4 p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-slate-900">
          <ScrollText className="h-4.5 w-4.5 text-slate-400" /> Trazabilidad del caso
        </h2>
        <ul className="space-y-2.5">
          {analysis.auditLogs.map((log) => (
            <li key={log.id} className="flex gap-3 text-xs">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
              <div>
                <p className="font-medium text-slate-700">
                  {log.action.replaceAll("_", " ")}
                  <span className="ml-2 font-normal text-slate-400">
                    {log.user?.name ?? "Sistema"} · {formatDate(log.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-slate-500">{log.details}</p>
              </div>
            </li>
          ))}
          {analysis.auditLogs.length === 0 ? (
            <li className="text-sm text-slate-400">Sin eventos registrados para este análisis.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
