"use client";

import { Printer } from "lucide-react";

/**
 * Abre el diálogo de impresión del navegador para exportar el informe a PDF.
 * Lleva la clase `no-print` para no aparecer en el propio documento impreso.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50"
    >
      <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir / Guardar en PDF
    </button>
  );
}
