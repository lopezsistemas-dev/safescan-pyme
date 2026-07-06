"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  FileSearch,
  FileText,
  Loader2,
  Lock,
  ShieldAlert,
  ClipboardList,
} from "lucide-react";
import {
  FLOW_DESCRIPTIONS,
  FLOW_LABELS,
  INDICATOR_TYPE_LABELS,
  type IndicatorType,
  type RecommendedFlow,
  type Verdict,
} from "@/lib/constants";
import { Card, ReportMarkdown, RiskBadge, ScoreBar, formatBytes } from "./ui";
import { AnalysisBadges, AnalysisTimeline, VerdictBanner } from "./analysis-ui";

interface IndicatorDto {
  id: string;
  type: string;
  value: string;
  risk: string;
}

interface AnalysisDto {
  id: string;
  inputType: string;
  originalName: string | null;
  inputValue: string | null;
  sha256: string | null;
  realType: string | null;
  fileSize: number | null;
  status: string;
  progressStage: string;
  progressPct: number;
  threatScore: number | null;
  sensitivityScore: number | null;
  recommendedFlow: string | null;
  finalVerdict: string | null;
  providerUsed: string | null;
  privateScanningUsed: boolean;
  mockMode: boolean;
  employeeReport: string | null;
  policyJson: string | null;
  tiJson: string | null;
  quarantined: boolean;
  indicators: IndicatorDto[];
}

interface PolicyData {
  reason?: string;
  privacyExplanation?: string;
  securityExplanation?: string;
  threatSignals?: string[];
  sensitivitySignals?: string[];
}

interface TiData {
  verdict?: string;
  detections?: string;
  reputation?: number;
  matchedThreats?: string[];
  explanation?: string;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Vista de análisis: dispara el pipeline, hace polling y muestra el resultado. */
export function AnalysisView({ id, agentIsMock }: { id: string; agentIsMock: boolean }) {
  const [analysis, setAnalysis] = useState<AnalysisDto | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const startedRef = useRef(false);

  // Lanzar el pipeline una sola vez (idempotente en el servidor)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void fetch(`/api/analysis/${id}/run`, { method: "POST" }).catch(() => {
      // el polling reflejará el estado real
    });
  }, [id]);

  // Polling del estado
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/analysis/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo consultar el análisis.");
        const data = (await res.json()) as { analysis: AnalysisDto };
        if (cancelled) return;
        setAnalysis(data.analysis);
        setFetchError(null);
        if (data.analysis.status !== "COMPLETADO" && data.analysis.status !== "ERROR") {
          timer = setTimeout(tick, 700);
        }
      } catch (err) {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : "Error de conexión.");
        timer = setTimeout(tick, 1500);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, retryTick]);

  if (!analysis) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando análisis…
      </div>
    );
  }

  const policy = parseJson<PolicyData>(analysis.policyJson);
  const ti = parseJson<TiData>(analysis.tiJson);
  const subject = analysis.originalName ?? analysis.inputValue ?? "elemento analizado";
  const running = analysis.status === "RECIBIDO" || analysis.status === "ANALIZANDO";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="sr-only">Análisis de {subject}</h1>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/agente"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al agente
        </Link>
        {analysis.status === "COMPLETADO" ? (
          <Link
            href={`/dashboard/informe/${analysis.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
          >
            <ClipboardList className="h-4 w-4" /> Ver informe completo
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Columna izquierda: timeline + metadatos */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Proceso de análisis</h3>
            <AnalysisTimeline progressPct={analysis.progressPct} error={analysis.status === "ERROR"} />
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-slate-400" /> Detalles
            </h3>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-slate-400">Elemento</dt>
                <dd className="font-medium break-all text-slate-700">{subject}</dd>
              </div>
              {analysis.realType ? (
                <div>
                  <dt className="text-slate-400">Tipo real detectado</dt>
                  <dd className="font-medium text-slate-700">{analysis.realType}</dd>
                </div>
              ) : null}
              {analysis.fileSize ? (
                <div>
                  <dt className="text-slate-400">Tamaño</dt>
                  <dd className="font-medium text-slate-700">{formatBytes(analysis.fileSize)}</dd>
                </div>
              ) : null}
              {analysis.sha256 ? (
                <div>
                  <dt className="text-slate-400">Huella SHA-256</dt>
                  <dd className="font-mono break-all text-slate-600">
                    {analysis.sha256.slice(0, 32)}…
                  </dd>
                </div>
              ) : null}
              {analysis.recommendedFlow ? (
                <div>
                  <dt className="text-slate-400">Flujo aplicado</dt>
                  <dd className="font-medium text-slate-700">
                    {FLOW_LABELS[analysis.recommendedFlow as RecommendedFlow] ?? analysis.recommendedFlow}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>

        {/* Columna principal */}
        <div className="space-y-4">
          {running ? (
            <Card className="flex flex-col items-center justify-center p-10 text-center">
              <span className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-100" />
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <FileSearch className="h-7 w-7" />
                </span>
              </span>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                Analizando en el entorno seguro…
              </h2>
              <p className="mt-1 text-sm text-slate-500">{analysis.progressStage}</p>
              <div
                className="mt-5 h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={analysis.progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso del análisis: ${analysis.progressStage}`}
              >
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${analysis.progressPct}%` }}
                />
              </div>
              <p className="mt-4 max-w-sm text-xs text-slate-400">
                El archivo permanece en cuarentena: nunca se abre ni se ejecuta. Solo se inspeccionan
                sus huellas, señales e indicadores.
              </p>
              {fetchError ? <p className="mt-2 text-xs text-red-500">{fetchError}</p> : null}
            </Card>
          ) : null}

          {analysis.status === "ERROR" ? (
            <Card className="border-red-200 p-6">
              <h2 className="flex items-center gap-2 font-semibold text-red-700">
                <ShieldAlert className="h-5 w-5" /> El análisis no pudo completarse
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Ha ocurrido un error técnico. El archivo sigue en cuarentena y no supone riesgo.
                Puedes reintentar el análisis o avisar al responsable.
              </p>
              <button
                onClick={async () => {
                  setFetchError(null);
                  // Optimista: volver a estado en curso y reactivar el polling
                  setAnalysis((prev) =>
                    prev ? { ...prev, status: "ANALIZANDO", progressPct: 5 } : prev
                  );
                  await fetch(`/api/analysis/${id}/run`, { method: "POST" }).catch(() => {});
                  setRetryTick((n) => n + 1);
                }}
                className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Reintentar análisis
              </button>
            </Card>
          ) : null}

          {analysis.status === "COMPLETADO" && analysis.finalVerdict ? (
            <>
              <VerdictBanner verdict={analysis.finalVerdict as Verdict} detail={policy?.reason} />

              <AnalysisBadges
                mockMode={analysis.mockMode}
                privateScanningUsed={analysis.privateScanningUsed}
                quarantined={analysis.quarantined}
                providerUsed={analysis.providerUsed}
                agentIsMock={agentIsMock}
              />

              <Card className="p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <ScoreBar
                    label="Riesgo de amenaza"
                    value={analysis.threatScore ?? 0}
                    hint="Malware, phishing, macros, ejecutables camuflados…"
                  />
                  <ScoreBar
                    label="Sensibilidad del contenido"
                    value={analysis.sensitivityScore ?? 0}
                    hint="DNI, IBAN, teléfonos, datos de clientes o pacientes…"
                  />
                </div>
              </Card>

              {/* Qué ha pasado */}
              <Card className="p-5">
                <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-slate-900">
                  <FileSearch className="h-4.5 w-4.5 text-brand-600" /> Qué ha pasado
                </h3>
                <p className="text-sm leading-relaxed text-slate-700">
                  {policy?.securityExplanation ?? "Análisis completado."}
                </p>
                {ti?.explanation ? (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                    <strong className="text-slate-700">Inteligencia de amenazas:</strong>{" "}
                    {ti.explanation}
                    {ti.detections ? (
                      <span className="ml-1 text-slate-500">({ti.detections} detecciones)</span>
                    ) : null}
                  </p>
                ) : null}
              </Card>

              {/* Qué debes hacer */}
              {analysis.employeeReport ? (
                <Card className="border-brand-200 bg-brand-50/40 p-5">
                  <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-slate-900">
                    <ClipboardList className="h-4.5 w-4.5 text-brand-600" /> Qué debes hacer
                  </h3>
                  <ReportMarkdown text={analysis.employeeReport} />
                </Card>
              ) : null}

              {/* Privacidad durante el análisis */}
              <Card className="border-emerald-200 bg-emerald-50/40 p-5">
                <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-slate-900">
                  <Lock className="h-4.5 w-4.5 text-emerald-600" /> Privacidad durante el análisis
                </h3>
                <p className="text-sm leading-relaxed text-slate-700">
                  {policy?.privacyExplanation ?? "El contenido no salió del entorno de la empresa."}
                </p>
                {analysis.recommendedFlow ? (
                  <p className="mt-2 text-xs text-slate-500">
                    <strong>{FLOW_LABELS[analysis.recommendedFlow as RecommendedFlow]}:</strong>{" "}
                    {FLOW_DESCRIPTIONS[analysis.recommendedFlow as RecommendedFlow]}
                  </p>
                ) : null}
              </Card>

              {/* Indicadores */}
              {analysis.indicators.length > 0 ? (
                <Card className="p-5">
                  <h3 className="mb-3 font-semibold text-slate-900">
                    Indicadores detectados{" "}
                    <span className="text-xs font-normal text-slate-400">
                      (los datos personales se muestran siempre enmascarados)
                    </span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs text-slate-400 uppercase">
                          <th className="pb-2 pr-4 font-medium">Tipo</th>
                          <th className="pb-2 pr-4 font-medium">Valor</th>
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
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
