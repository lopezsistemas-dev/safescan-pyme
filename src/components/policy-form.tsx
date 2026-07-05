"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { TenantPolicy } from "@/lib/tenant";
import { Card } from "./ui";

/** Formulario de la política demo de la empresa (umbral, flujos, keywords). */
export function PolicyForm({ initial }: { initial: TenantPolicy }) {
  const router = useRouter();
  const [policy, setPolicy] = useState(initial);
  const [keywordsText, setKeywordsText] = useState(initial.palabrasSensiblesExtra.join(", "));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/tenant/policy", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...policy,
          palabrasSensiblesExtra: keywordsText
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean)
            .slice(0, 20),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo guardar la política.");
      }
      setMessage("Política guardada. Se aplicará a los próximos análisis.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  const numberInput =
    "h-10 w-24 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <Card className="p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Umbral de amenaza (0-100)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={policy.umbralAmenaza}
            onChange={(e) => setPolicy({ ...policy, umbralAmenaza: Number(e.target.value) })}
            className={numberInput}
          />
          <span className="mt-1 block text-xs text-slate-400">
            A partir de esta puntuación, el elemento se considera sospechoso.
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Umbral de sensibilidad (0-100)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={policy.umbralSensibilidad}
            onChange={(e) => setPolicy({ ...policy, umbralSensibilidad: Number(e.target.value) })}
            className={numberInput}
          />
          <span className="mt-1 block text-xs text-slate-400">
            A partir de esta puntuación, el documento se trata como sensible.
          </span>
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {(
          [
            {
              key: "bloquearEjecutables",
              label: "Bloquear ejecutables y dobles extensiones directamente en cuarentena",
            },
            {
              key: "privateScanningPreferido",
              label: "Priorizar Private Scanning para documentos sensibles (simulado en el MVP)",
            },
            {
              key: "notificarResponsable",
              label: "Notificar al responsable en veredictos de bloqueo o escalado",
            },
          ] as const
        ).map(({ key, label }) => (
          <label key={key} className="flex items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={policy[key]}
              onChange={(e) => setPolicy({ ...policy, [key]: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-brand-600"
            />
            {label}
          </label>
        ))}
      </div>

      <label className="mt-5 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Palabras sensibles propias del negocio
        </span>
        <textarea
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          rows={2}
          placeholder="separadas por comas: reserva, huésped, historia clínica…"
          className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <span className="mt-1 block text-xs text-slate-400">
          Se suman a la lista base (factura, contrato, nómina, IBAN, DNI…) al puntuar la sensibilidad.
        </span>
      </label>

      {message ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        onClick={save}
        disabled={busy}
        className="mt-5 flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar política
      </button>
    </Card>
  );
}
