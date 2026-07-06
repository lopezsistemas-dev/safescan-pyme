import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { getSessionContext } from "@/lib/tenant";
import { NavLinks } from "@/components/nav-links";
import { Badge } from "@/components/ui";

/**
 * Layout del portal privado de empresa: exige empresa demo seleccionada
 * y muestra la cabecera con el dominio propio del cliente.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/seleccionar-empresa");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Link href="/agente" className="flex items-center gap-2" aria-label="SafeScan PYME — ir al agente">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="hidden text-base font-bold text-slate-900 md:inline">
                SafeScan <span className="text-brand-600">PYME</span>
              </span>
            </Link>
            <span className="hidden h-5 w-px bg-slate-200 lg:block" />
            <span className="hidden items-center gap-1.5 text-sm text-slate-500 lg:flex">
              <Building2 className="h-4 w-4" />
              {ctx.tenant.domain}
            </span>
          </div>

          <NavLinks />

          <div className="flex items-center gap-2">
            <Badge tone="brand" title={`${ctx.user.name} · ${ctx.tenant.name}`}>
              <UserRound className="h-3 w-3" />
              {ctx.user.name.split(" ")[0]} · {ctx.user.role === "RESPONSABLE" ? "Responsable" : "Empleado"}
            </Badge>
            <Link
              href="/seleccionar-empresa"
              className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
            >
              Cambiar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">{children}</main>

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1 px-4 py-3 text-xs text-slate-400 sm:flex-row">
          <span>
            Portal privado de <strong className="text-slate-500">{ctx.tenant.name}</strong> · {ctx.tenant.sector}
          </span>
          <span>La privacidad durante el análisis también es ciberseguridad.</span>
        </div>
      </footer>
    </div>
  );
}
