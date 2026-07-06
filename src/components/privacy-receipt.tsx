import { ArrowUpRight, ReceiptText, ShieldCheck } from "lucide-react";
import { dataEgressFor } from "@/lib/policy/egress";
import type { RecommendedFlow } from "@/lib/constants";
import { Card } from "./ui";

/**
 * Recibo de privacidad de un análisis: mapa auditable de qué salió del entorno
 * de la empresa y qué nunca salió. Convierte la tesis del producto en evidencia
 * verificable, a partir de datos que ya se persisten.
 */
export function PrivacyReceipt({
  inputType,
  flow,
  mockMode,
}: {
  inputType: string;
  flow: RecommendedFlow | null;
  mockMode: boolean;
}) {
  const egress = dataEgressFor({ inputType, flow, mockMode });

  return (
    <Card className="print-avoid-break p-5">
      <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-900">
        <ReceiptText className="h-4.5 w-4.5 text-emerald-600" aria-hidden="true" /> Recibo de
        privacidad de este análisis
      </h3>
      <p className="mb-4 text-xs text-slate-500">{egress.summary}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Salió del entorno */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-700 uppercase">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> Salió del entorno
          </p>
          {egress.left.length === 0 ? (
            <p className="text-sm text-slate-600">Nada. El análisis fue completamente local.</p>
          ) : (
            <ul className="space-y-2">
              {egress.left.map((item) => (
                <li key={item.label}>
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </li>
              ))}
            </ul>
          )}
          {egress.simulated && egress.left.length > 0 ? (
            <p className="mt-3 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Envío simulado (modo demo determinista)
            </p>
          ) : null}
        </div>

        {/* Nunca salió del entorno */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-emerald-700 uppercase">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Nunca salió del entorno
          </p>
          <ul className="space-y-2">
            {egress.neverLeft.map((item) => (
              <li key={item.label}>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
