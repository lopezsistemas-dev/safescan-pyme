import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { TenantSelector } from "@/components/tenant-selector";

export const dynamic = "force-dynamic";

/** Selector de empresa demo: cada pyme accede desde su propio portal. */
export default async function SelectTenantPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      users: {
        orderBy: { role: "asc" }, // EMPLEADO primero
        select: { id: true, name: true, role: true },
      },
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a la presentación
      </Link>

      <div className="mb-8 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="text-3xl font-bold text-slate-900">Elige tu empresa</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          En producción, cada cliente accede desde su propio dominio privado
          (seguridad.asesorialopez.es, scan.hotelmalaga.com…). En esta demo, selecciona empresa y
          usuario para entrar en su portal.
        </p>
        <p className="mx-auto mt-4 max-w-xl rounded-xl border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
          <strong className="font-semibold">Recorrido sugerido:</strong> entra como{" "}
          <strong className="font-semibold">Empleado</strong>, analiza un archivo de ejemplo en el
          agente y vuelve como <strong className="font-semibold">Responsable</strong> para ver el
          panel de seguridad.
        </p>
      </div>

      <TenantSelector
        tenants={tenants.map((t) => ({
          id: t.id,
          name: t.name,
          domain: t.domain,
          sector: t.sector,
          users: t.users,
        }))}
      />
    </div>
  );
}
