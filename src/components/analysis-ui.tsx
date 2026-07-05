import {
  AlertTriangle,
  Archive,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  Bot,
  Lock,
  ShieldCheck,
  FlaskConical,
} from "lucide-react";
import { VERDICT_LABELS, PIPELINE_STAGES, type Verdict } from "@/lib/constants";
import { Badge } from "./ui";

/** Componentes de dominio: veredictos, badges de proveedor y timeline. */

const VERDICT_STYLES: Record<
  Verdict,
  { container: string; iconColor: string; Icon: typeof CheckCircle2; description: string }
> = {
  ABRIR: {
    container: "border-emerald-200 bg-emerald-50",
    iconColor: "text-emerald-600",
    Icon: CheckCircle2,
    description: "El análisis no ha encontrado señales de riesgo.",
  },
  ABRIR_CON_PRECAUCION: {
    container: "border-amber-200 bg-amber-50",
    iconColor: "text-amber-600",
    Icon: AlertTriangle,
    description: "Puedes abrirlo, pero sigue las precauciones indicadas.",
  },
  BLOQUEAR: {
    container: "border-red-200 bg-red-50",
    iconColor: "text-red-600",
    Icon: Ban,
    description: "No lo abras. El riesgo detectado es alto.",
  },
  ESCALAR: {
    container: "border-orange-200 bg-orange-50",
    iconColor: "text-orange-600",
    Icon: ArrowUpCircle,
    description: "El responsable de tu empresa ha recibido el caso.",
  },
  CUARENTENA: {
    container: "border-slate-300 bg-slate-100",
    iconColor: "text-slate-600",
    Icon: Archive,
    description: "El archivo queda retenido de forma segura.",
  },
};

export function VerdictBanner({ verdict, detail }: { verdict: Verdict; detail?: string }) {
  const style = VERDICT_STYLES[verdict];
  const Icon = style.Icon;
  return (
    <div className={`flex items-start gap-4 rounded-2xl border p-5 ${style.container}`}>
      <Icon className={`mt-0.5 h-9 w-9 shrink-0 ${style.iconColor}`} strokeWidth={2.2} />
      <div>
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Recomendación
        </p>
        <h2 className="text-2xl font-bold text-slate-900">{VERDICT_LABELS[verdict]}</h2>
        <p className="mt-1 text-sm text-slate-700">{detail ?? style.description}</p>
      </div>
    </div>
  );
}

export function VerdictPill({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <Badge tone="slate">Pendiente</Badge>;
  const tone =
    verdict === "ABRIR"
      ? ("emerald" as const)
      : verdict === "ABRIR_CON_PRECAUCION"
        ? ("amber" as const)
        : verdict === "BLOQUEAR"
          ? ("red" as const)
          : verdict === "ESCALAR"
            ? ("amber" as const)
            : ("slate" as const);
  return <Badge tone={tone}>{VERDICT_LABELS[verdict]}</Badge>;
}

/** Badges de contexto del análisis: privacidad, proveedor y modo. */
export function AnalysisBadges({
  mockMode,
  privateScanningUsed,
  quarantined,
  providerUsed,
  agentIsMock,
}: {
  mockMode: boolean;
  privateScanningUsed: boolean;
  quarantined: boolean;
  providerUsed?: string | null;
  agentIsMock?: boolean;
}) {
  const usesVirusTotal = Boolean(providerUsed && !providerUsed.toLowerCase().includes("local"));
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge tone="emerald" title="El contenido no sale del entorno de la empresa">
        <Lock className="h-3 w-3" /> Privado
      </Badge>
      {quarantined ? (
        <Badge tone="amber" title="El archivo está retenido en cuarentena">
          <Archive className="h-3 w-3" /> Cuarentena
        </Badge>
      ) : null}
      {usesVirusTotal ? (
        <Badge tone="sky" title={providerUsed ?? ""}>
          <ShieldCheck className="h-3 w-3" /> VirusTotal
        </Badge>
      ) : null}
      {privateScanningUsed ? (
        <Badge tone="indigo" title="Análisis privado: sin subida a corpus público (simulado en el MVP)">
          <Lock className="h-3 w-3" /> Private Scanning
        </Badge>
      ) : null}
      <Badge tone="violet" title={agentIsMock ? "Informes con plantillas locales (sin clave Gemini)" : "Informes generados con Gemini"}>
        <Bot className="h-3 w-3" /> {agentIsMock ? "Agente local" : "Gemini"}
      </Badge>
      {mockMode ? (
        <Badge tone="slate" title="Análisis simulado para el MVP (sin claves de API reales)">
          <FlaskConical className="h-3 w-3" /> Mock
        </Badge>
      ) : null}
    </div>
  );
}

/** Timeline del pipeline de análisis. */
export function AnalysisTimeline({ progressPct, error }: { progressPct: number; error?: boolean }) {
  return (
    <ol className="space-y-0">
      {PIPELINE_STAGES.map((stage, i) => {
        const done = progressPct > stage.pct || progressPct >= 100;
        const active = !done && progressPct === stage.pct;
        const isLast = i === PIPELINE_STAGES.length - 1;
        return (
          <li key={stage.pct} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast ? (
              <span
                className={`absolute top-6 left-[11px] h-full w-0.5 ${done ? "bg-brand-400" : "bg-slate-200"}`}
              />
            ) : null}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                done
                  ? "border-brand-500 bg-brand-500 text-white"
                  : active
                    ? error
                      ? "border-red-500 bg-red-50 text-red-600"
                      : "animate-pulse border-brand-500 bg-white text-brand-600"
                    : "border-slate-300 bg-white text-slate-400"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`text-sm ${done ? "text-slate-700" : active ? "font-semibold text-slate-900" : "text-slate-400"}`}
            >
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
