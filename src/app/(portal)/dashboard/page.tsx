import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Ban, FileSearch, ScrollText, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionContext } from "@/lib/tenant";
import {
  FLOW_LABELS,
  INPUT_TYPE_LABELS,
  SAFEDOCS_OPERATION_LABELS,
  type InputType,
  type RecommendedFlow,
  type SafeDocsOperation,
  type Verdict,
} from "@/lib/constants";
import { maskPiiInText } from "@/lib/containment/indicators";
import { Badge, Card, formatDate } from "@/components/ui";
import { VerdictPill } from "@/components/analysis-ui";
import { AnalysisActions, SweepButton } from "@/components/dashboard-actions";

export const dynamic = "force-dynamic";

/** Dashboard del responsable: historial, cuarentena, informes y auditoría. */
export default async function DashboardPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/seleccionar-empresa");

  const [analyses, jobs, auditLogs] = await Promise.all([
    prisma.analysis.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
    prisma.safeDocsJob.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
    prisma.auditLog.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const stats = {
    total: analyses.length,
    blocked: analyses.filter((a) => a.finalVerdict === "BLOQUEAR" || a.finalVerdict === "CUARENTENA").length,
    inQuarantine: analyses.filter((a) => a.quarantined && !a.fileDeleted).length,
    pending: analyses.filter((a) => a.status === "COMPLETADO" && !a.resolved).length,
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel del responsable</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {ctx.tenant.name} · retención de archivos: {env.RETENTION_HOURS} h · límite de subida: {env.MAX_UPLOAD_MB} MB
          </p>
        </div>
        <SweepButton />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Análisis registrados", value: stats.total, Icon: FileSearch, tone: "text-brand-600 bg-brand-50" },
          { label: "Bloqueados / cuarentena", value: stats.blocked, Icon: Ban, tone: "text-red-600 bg-red-50" },
          { label: "Archivos retenidos", value: stats.inQuarantine, Icon: Archive, tone: "text-amber-600 bg-amber-50" },
          { label: "Pendientes de revisar", value: stats.pending, Icon: TriangleAlert, tone: "text-orange-600 bg-orange-50" },
        ].map(({ label, value, Icon, tone }) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabla de análisis */}
      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Análisis recientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                <th className="px-5 py-2.5 font-medium">Elemento</th>
                <th className="px-3 py-2.5 font-medium">Usuario</th>
                <th className="px-3 py-2.5 font-medium">Fecha</th>
                <th className="px-3 py-2.5 text-center font-medium">Amenaza</th>
                <th className="px-3 py-2.5 text-center font-medium">Sensib.</th>
                <th className="px-3 py-2.5 font-medium">Veredicto</th>
                <th className="px-3 py-2.5 font-medium">Flujo</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-5 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((analysis) => (
                <tr key={analysis.id} className="border-b border-slate-50 align-top hover:bg-slate-50/60">
                  <td className="max-w-56 px-5 py-3">
                    <p className="truncate font-medium text-slate-800">
                      {analysis.originalName ?? (analysis.inputValue ? maskPiiInText(analysis.inputValue) : "—")}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-400">
                      {INPUT_TYPE_LABELS[analysis.inputType as InputType] ?? analysis.inputType}
                      {analysis.mockMode ? <Badge tone="slate">Mock</Badge> : null}
                      {analysis.privateScanningUsed ? <Badge tone="indigo">PS</Badge> : null}
                    </p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">{analysis.user.name}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-500">
                    {formatDate(analysis.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ScoreDot value={analysis.threatScore} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ScoreDot value={analysis.sensitivityScore} />
                  </td>
                  <td className="px-3 py-3">
                    <VerdictPill verdict={analysis.finalVerdict as Verdict | null} />
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">
                    {analysis.recommendedFlow
                      ? (FLOW_LABELS[analysis.recommendedFlow as RecommendedFlow] ?? analysis.recommendedFlow)
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">
                    {analysis.quarantined && !analysis.fileDeleted ? (
                      <Badge tone="amber">En cuarentena</Badge>
                    ) : analysis.resolved ? (
                      <Badge tone="emerald">Resuelto</Badge>
                    ) : analysis.status === "COMPLETADO" ? (
                      <Badge tone="slate">Pendiente</Badge>
                    ) : (
                      <Badge tone="sky">{analysis.status === "ERROR" ? "Error" : "En curso"}</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <AnalysisActions
                      analysisId={analysis.id}
                      hasFile={Boolean(analysis.filePath) && !analysis.fileDeleted}
                      resolved={analysis.resolved}
                    />
                  </td>
                </tr>
              ))}
              {analyses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-sm text-slate-400">
                    Aún no hay análisis.{" "}
                    <Link
                      href="/agente"
                      className="font-medium text-brand-600 underline-offset-2 hover:underline"
                    >
                      Ir al agente y analizar tu primer archivo
                    </Link>
                    .
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* SafeDocs */}
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">SafeDocs recientes</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-400">Sin trabajos SafeDocs todavía.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-slate-700">
                    {SAFEDOCS_OPERATION_LABELS[job.operation as SafeDocsOperation] ?? job.operation}
                    <span className="ml-2 text-xs text-slate-400">
                      {job.user.name} · {formatDate(job.createdAt)}
                    </span>
                  </span>
                  <Badge tone="emerald">Local</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Auditoría */}
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ScrollText className="h-4 w-4 text-slate-400" /> Registro de auditoría
          </h2>
          <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <li key={log.id} className="text-xs">
                <p className="font-medium text-slate-700">
                  {log.action.replaceAll("_", " ")}
                  <span className="ml-2 font-normal text-slate-400">
                    {log.user?.name ?? "Sistema"} · {formatDate(log.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-slate-500">{log.details}</p>
              </li>
            ))}
            {auditLogs.length === 0 ? (
              <li className="text-sm text-slate-400">Sin eventos registrados.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ScoreDot({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-slate-300">—</span>;
  const color =
    value >= 70 ? "bg-red-500 text-white" : value >= 40 ? "bg-amber-400 text-amber-950" : "bg-emerald-500 text-white";
  return (
    <span
      className={`inline-flex h-7 w-9 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${color}`}
    >
      {value}
    </span>
  );
}
