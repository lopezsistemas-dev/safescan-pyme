import type { ReactNode } from "react";

/**
 * Componentes de UI propios de SafeScan: ligeros, consistentes y sin
 * dependencias externas (estilo profesional de confianza para pymes).
 */

// ── Card ──────────────────────────────────────────────────────────────────

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────

export type BadgeTone =
  | "brand"
  | "emerald"
  | "amber"
  | "red"
  | "violet"
  | "sky"
  | "indigo"
  | "slate";

const BADGE_TONES: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export function Badge({
  tone = "slate",
  children,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Badge de nivel de riesgo de un indicador (ALTO/MEDIO/BAJO). */
export function RiskBadge({ risk }: { risk: string }) {
  const tone: BadgeTone = risk === "ALTO" ? "red" : risk === "MEDIO" ? "amber" : "emerald";
  return <Badge tone={tone}>{risk}</Badge>;
}

// ── ScoreBar ──────────────────────────────────────────────────────────────

export function ScoreBar({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  const color = value >= 70 ? "bg-red-500" : value >= 40 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = value >= 70 ? "text-red-700" : value >= 40 ? "text-amber-700" : "text-emerald-700";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${textColor}`}>{value}/100</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.max(3, value)}%` }}
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

// ── Mini-markdown ─────────────────────────────────────────────────────────

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Solo negritas **texto**: suficiente para los informes generados
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

/**
 * Renderizador mínimo y seguro del markdown de los informes
 * (títulos ##/###, listas con "-", negritas). Sin HTML crudo.
 */
export function ReportMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="my-2 ml-1 space-y-1.5">
        {list.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            <span>{renderInline(item, `li-${key}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      list.push(trimmed.slice(2));
      return;
    }
    flushList(`ul-${idx}`);
    if (!trimmed) return;
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4 key={idx} className="mt-4 mb-1 text-sm font-semibold tracking-wide text-slate-900 uppercase">
          {trimmed.slice(4)}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3 key={idx} className="mt-1 mb-2 text-base font-bold text-slate-900">
          {trimmed.slice(3)}
        </h3>
      );
    } else {
      blocks.push(
        <p key={idx} className="my-1.5 text-sm leading-relaxed text-slate-700">
          {renderInline(trimmed, `p-${idx}`)}
        </p>
      );
    }
  });
  flushList("ul-final");

  return <div>{blocks}</div>;
}

// ── Formato ───────────────────────────────────────────────────────────────

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
