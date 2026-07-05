import { redirect } from "next/navigation";
import { FileStack } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/tenant";
import { SAFEDOCS_OPERATION_LABELS, type SafeDocsOperation } from "@/lib/constants";
import { Card, formatDate } from "@/components/ui";
import { SafeDocsPanel } from "@/components/safedocs-panel";

export const dynamic = "force-dynamic";

/** SafeDocs: herramientas privadas para documentos cotidianos. */
export default async function SafeDocsPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/seleccionar-empresa");

  const jobs = await prisma.safeDocsJob.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <FileStack className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">SafeDocs</h1>
        <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
          SafeScan protege documentos sospechosos.{" "}
          <strong className="text-slate-700">SafeDocs protege documentos cotidianos.</strong> Une,
          extrae, rota y limpia metadatos de tus PDFs sin usar webs externas: todo se procesa en el
          entorno privado de {ctx.tenant.name}.
        </p>
      </div>

      <SafeDocsPanel />

      {jobs.length > 0 ? (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Últimos trabajos</h2>
          <ul className="divide-y divide-slate-100">
            {jobs.map((job) => {
              let inputs: string[] = [];
              try {
                inputs = JSON.parse(job.inputFiles) as string[];
              } catch {
                inputs = [];
              }
              return (
                <li key={job.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700">
                      {SAFEDOCS_OPERATION_LABELS[job.operation as SafeDocsOperation] ?? job.operation}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {inputs.join(", ")} · {job.user.name} · {formatDate(job.createdAt)}
                    </p>
                  </div>
                  {job.outputFile ? (
                    <a
                      href={`/api/safedocs/download/${job.id}`}
                      className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      Descargar
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400">
                      Eliminado por retención
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
