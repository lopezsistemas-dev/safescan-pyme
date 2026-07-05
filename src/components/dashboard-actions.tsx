"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrushCleaning, CheckCheck, FileText, Loader2, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";

/** Acciones del responsable sobre un análisis (dashboard). */
export function AnalysisActions({
  analysisId,
  hasFile,
  resolved,
}: {
  analysisId: string;
  hasFile: boolean;
  resolved: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function call(action: string, url: string, init: RequestInit) {
    setBusy(action);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        alert(data?.error ?? "La acción no se pudo completar.");
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const buttonClass =
    "flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={`/dashboard/informe/${analysisId}`} className={buttonClass} title="Ver informe completo">
        <FileText className="h-3.5 w-3.5" /> Informe
      </Link>
      <button
        onClick={() => call("resolve", `/api/analysis/${analysisId}/resolve`, { method: "POST" })}
        disabled={busy !== null}
        className={buttonClass}
        title={resolved ? "Volver a marcar como pendiente" : "Marcar como resuelto"}
      >
        {busy === "resolve" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : resolved ? (
          <Undo2 className="h-3.5 w-3.5" />
        ) : (
          <CheckCheck className="h-3.5 w-3.5" />
        )}
        {resolved ? "Reabrir" : "Resolver"}
      </button>
      {hasFile ? (
        <button
          onClick={() => {
            if (confirm("¿Eliminar definitivamente el archivo de la cuarentena?")) {
              void call("delete", `/api/analysis/${analysisId}/file`, { method: "DELETE" });
            }
          }}
          disabled={busy !== null}
          className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
          title="Eliminar el archivo de la cuarentena"
        >
          {busy === "delete" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Eliminar
        </button>
      ) : null}
    </div>
  );
}

/** Botón de limpieza manual de archivos expirados (retención). */
export function SweepButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sweep() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/retention/sweep", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { quarantine?: number; safedocs?: number; inputs?: number }
        | null;
      const total = (data?.quarantine ?? 0) + (data?.safedocs ?? 0) + (data?.inputs ?? 0);
      setMessage(
        total > 0
          ? `${total} archivo(s) expirados eliminados.`
          : "No hay archivos expirados pendientes."
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {message ? <span className="text-xs text-slate-400">{message}</span> : null}
      <button
        onClick={sweep}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
        title="Eliminar ahora los archivos que superan la retención configurada"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrushCleaning className="h-3.5 w-3.5" />}
        Limpiar expirados
      </button>
    </div>
  );
}
