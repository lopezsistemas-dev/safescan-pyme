import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Multicliente demo: el tenant y el usuario activos se guardan en cookies.
 * No hay autenticación real en el MVP (documentado como limitación);
 * todas las consultas se filtran siempre por tenantId.
 */

export const TENANT_COOKIE = "safescan_tenant";
export const USER_COOKIE = "safescan_user";

export interface TenantPolicy {
  umbralAmenaza: number;
  umbralSensibilidad: number;
  bloquearEjecutables: boolean;
  privateScanningPreferido: boolean;
  notificarResponsable: boolean;
  palabrasSensiblesExtra: string[];
}

export const DEFAULT_POLICY: TenantPolicy = {
  umbralAmenaza: 60,
  umbralSensibilidad: 60,
  bloquearEjecutables: true,
  privateScanningPreferido: false,
  notificarResponsable: true,
  palabrasSensiblesExtra: [],
};

export function parsePolicy(policyJson: string | null | undefined): TenantPolicy {
  try {
    const raw = JSON.parse(policyJson || "{}");
    return { ...DEFAULT_POLICY, ...raw };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

export interface SessionContext {
  tenant: { id: string; name: string; domain: string; sector: string; policy: TenantPolicy };
  user: { id: string; name: string; role: string; email: string };
}

/**
 * Contexto de sesión desde cookies. Devuelve null si no hay empresa
 * seleccionada (la UI redirige entonces al selector de empresa).
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const tenantId = cookieStore.get(TENANT_COOKIE)?.value;
  const userId = cookieStore.get(USER_COOKIE)?.value;
  if (!tenantId || !userId) return null;

  let user;
  try {
    user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });
  } catch (err) {
    // Un fallo de BD no debe propagarse como 500 opaco: se trata como sin sesión
    console.error("[tenant] error consultando la sesión:", err);
    return null;
  }
  if (!user) return null;

  return {
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      domain: user.tenant.domain,
      sector: user.tenant.sector,
      policy: parsePolicy(user.tenant.policy),
    },
    user: { id: user.id, name: user.name, role: user.role, email: user.email },
  };
}
