"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Combine,
  Download,
  Eraser,
  Loader2,
  RotateCw,
  Scissors,
} from "lucide-react";
import { Card } from "./ui";

type Operation = "merge" | "split" | "rotate" | "clean";

interface OperationResult {
  fileName: string;
  downloadUrl: string;
}

const OPERATIONS: {
  id: Operation;
  title: string;
  description: string;
  Icon: typeof Combine;
  multiple: boolean;
}[] = [
  {
    id: "merge",
    title: "Unir PDFs",
    description: "Combina varios PDFs en un único documento, en el orden seleccionado.",
    Icon: Combine,
    multiple: true,
  },
  {
    id: "split",
    title: "Extraer páginas",
    description: "Extrae un rango de páginas (por ejemplo 1-3,5) a un nuevo PDF.",
    Icon: Scissors,
    multiple: false,
  },
  {
    id: "rotate",
    title: "Rotar PDF",
    description: "Gira todas las páginas 90, 180 o 270 grados.",
    Icon: RotateCw,
    multiple: false,
  },
  {
    id: "clean",
    title: "Limpiar metadatos",
    description: "Elimina autor, título, software y fechas: datos que revelan información interna.",
    Icon: Eraser,
    multiple: false,
  },
];

/** Panel de operaciones SafeDocs (todas 100% locales). */
export function SafeDocsPanel() {
  const router = useRouter();
  const [active, setActive] = useState<Operation>("merge");
  const [files, setFiles] = useState<FileList | null>(null);
  const [ranges, setRanges] = useState("1");
  const [angle, setAngle] = useState("90");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);

  const operation = OPERATIONS.find((op) => op.id === active)!;

  function reset(op: Operation) {
    setActive(op);
    setFiles(null);
    setError(null);
    setResult(null);
  }

  async function submit() {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("files", file);
    if (active === "split") formData.append("ranges", ranges);
    if (active === "rotate") formData.append("angle", angle);

    try {
      const res = await fetch(`/api/safedocs/${active}`, { method: "POST", body: formData });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; fileName?: string; downloadUrl?: string }
        | null;
      if (!res.ok || !data?.downloadUrl) {
        throw new Error(data?.error ?? "No se pudo completar la operación.");
      }
      setResult({ fileName: data.fileName ?? "documento.pdf", downloadUrl: data.downloadUrl });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      {/* Selector de operación */}
      <div className="space-y-2">
        {OPERATIONS.map(({ id, title, Icon }) => (
          <button
            key={id}
            onClick={() => reset(id)}
            className={`flex w-full items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
              active === id
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <Icon className="h-4.5 w-4.5" /> {title}
          </button>
        ))}
      </div>

      {/* Formulario de la operación activa */}
      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">{operation.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{operation.description}</p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              {operation.multiple ? "Selecciona 2 o más PDFs" : "Selecciona un PDF"}
            </span>
            <input
              key={active} // resetea el input al cambiar de operación
              type="file"
              accept="application/pdf"
              multiple={operation.multiple}
              onChange={(e) => setFiles(e.target.files)}
              className="block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:border-brand-300"
            />
          </label>

          {active === "split" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Páginas a extraer
              </span>
              <input
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
                placeholder="Ej.: 1-3,5"
                className="h-10 w-40 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
          ) : null}

          {active === "rotate" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Ángulo</span>
              <select
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                className="h-10 w-40 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400"
              >
                <option value="90">90º</option>
                <option value="180">180º</option>
                <option value="270">270º</option>
              </select>
            </label>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm text-emerald-800">
                Listo: <strong>{result.fileName}</strong> generado en el entorno privado.
              </p>
              <a
                href={result.downloadUrl}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" /> Descargar
              </a>
            </div>
          ) : null}

          <button
            onClick={submit}
            disabled={busy || !files || files.length === 0}
            className="flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Procesando…" : "Procesar en local"}
          </button>

          <p className="text-xs text-slate-400">
            Ningún documento sale del servidor del MVP. El resultado se elimina automáticamente por
            la política de retención.
          </p>
        </div>
      </Card>
    </div>
  );
}
