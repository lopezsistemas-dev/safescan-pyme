import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { env } from "@/lib/env";
import { getSessionContext } from "@/lib/tenant";
import { Badge, Card } from "@/components/ui";
import { PolicyForm } from "@/components/policy-form";

export const dynamic = "force-dynamic";

/** Configuración de políticas demo por empresa + estado del entorno. */
export default async function PoliciesPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/seleccionar-empresa");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <SlidersHorizontal className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Políticas de {ctx.tenant.name}</h1>
        <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
          Cada empresa decide cómo se analizan sus documentos. No todos los archivos deben
          analizarse igual: el Policy &amp; Privacy Engine aplica estos criterios en cada análisis.
        </p>
      </div>

      <PolicyForm initial={ctx.tenant.policy} />

      <Card className="mt-4 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Estado del entorno (MVP)</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge tone={env.threatIntelIsMock ? "slate" : "sky"}>
            Threat intelligence: {env.threatIntelIsMock ? "mock (simulado)" : "VirusTotal API real"}
          </Badge>
          <Badge tone={env.agentIsMock ? "slate" : "violet"}>
            Agente IA: {env.agentIsMock ? "mock (plantillas locales)" : `Gemini (${env.GEMINI_MODEL})`}
          </Badge>
          <Badge tone={env.VIRUSTOTAL_PRIVATE_SCANNING_ENABLED ? "indigo" : "slate"}>
            Private Scanning: {env.VIRUSTOTAL_PRIVATE_SCANNING_ENABLED ? "flag activo (conector preparado)" : "simulado para el MVP"}
          </Badge>
          <Badge tone="emerald">Retención: {env.RETENTION_HOURS} h</Badge>
          <Badge tone="emerald">Límite subida: {env.MAX_UPLOAD_MB} MB</Badge>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Estos valores se configuran en el archivo <code className="font-mono">.env</code>{" "}
          (GEMINI_API_KEY, VIRUSTOTAL_API_KEY, MOCK_SECURITY_ANALYSIS, RETENTION_HOURS,
          MAX_UPLOAD_MB, ALLOWED_FILE_TYPES). Sin claves reales, el MVP funciona íntegramente en
          modo simulado. La integración real de Private Scanning requiere licencia Premium y acuerdo
          autorizado con VirusTotal/Google.
        </p>
      </Card>
    </div>
  );
}
