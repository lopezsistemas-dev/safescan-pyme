"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Globe, Loader2, UserRound } from "lucide-react";
import { Card } from "./ui";

interface TenantOption {
  id: string;
  name: string;
  domain: string;
  sector: string;
  users: { id: string; name: string; role: string }[];
}

/** Selector de empresa y usuario demo (multicliente simulado). */
export function TenantSelector({ tenants }: { tenants: TenantOption[] }) {
  const router = useRouter();
  const [loadingUser, setLoadingUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Punto de entrada sugerido: el primer empleado de la primera empresa.
  const startHereUserId = tenants[0]?.users.find((u) => u.role !== "RESPONSABLE")?.id ?? null;

  async function select(tenantId: string, userId: string) {
    setLoadingUser(userId);
    setError(null);
    try {
      const res = await fetch("/api/tenant/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, userId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo iniciar la sesión demo.");
      }
      router.push("/agente");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setLoadingUser(null);
    }
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {tenants.map((tenant) => (
          <Card key={tenant.id} className="flex flex-col p-5">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Building2 className="h-5 w-5" />
            </span>
            <h2 className="font-semibold text-slate-900">{tenant.name}</h2>
            <p className="text-sm text-slate-500">{tenant.sector}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <Globe className="h-3 w-3" /> {tenant.domain}
            </p>
            <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
              {tenant.users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => select(tenant.id, user.id)}
                  disabled={loadingUser !== null}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-slate-400" />
                    <span>
                      <span className="font-medium text-slate-800">{user.name}</span>
                      <span className="block text-xs text-slate-500">
                        {user.role === "RESPONSABLE" ? "Responsable de seguridad" : "Empleado/a"}
                      </span>
                    </span>
                  </span>
                  {loadingUser === user.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                  ) : user.id === startHereUserId ? (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Empieza aquí
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
