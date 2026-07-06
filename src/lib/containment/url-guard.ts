/**
 * Validación y normalización de una URL pegada por el usuario antes de
 * analizarla. Objetivo: no dejar que entradas absurdas produzcan veredictos
 * sin sentido y dar mensajes claros en castellano.
 *
 * Acepta URLs sin protocolo (prepende http://). Rechaza:
 *  - esquemas que no sean http/https (file:, javascript:, data:, mailto:…)
 *  - credenciales embebidas (usuario:contraseña@)
 *  - hosts sin dominio válido (una sola etiqueta como "a" o "localhost")
 */
export type UrlGuardResult = { ok: true; url: string } | { ok: false; message: string };

export function guardAnalysisUrl(raw: string): UrlGuardResult {
  const trimmed = raw.trim();
  let candidate = trimmed;

  const schemeWithSlashes = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(trimmed);
  if (schemeWithSlashes) {
    const scheme = schemeWithSlashes[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") {
      return { ok: false, message: "Solo se analizan enlaces http o https." };
    }
  } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    // Esquema sin "//" (javascript:, mailto:, data:, file:…)
    return { ok: false, message: "Solo se analizan enlaces http o https." };
  } else {
    candidate = `http://${trimmed}`;
  }

  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { ok: false, message: "El texto pegado no parece una URL válida." };
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, message: "Solo se analizan enlaces http o https." };
  }
  if (u.username || u.password) {
    return { ok: false, message: "El enlace no debe incluir credenciales (usuario:contraseña@)." };
  }

  const host = u.hostname;
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const isIpv6 = host.startsWith("[") || host.includes(":");
  if (!host.includes(".") && !isIpv4 && !isIpv6) {
    return {
      ok: false,
      message: "El enlace no tiene un dominio válido (debe incluir un dominio, p. ej. ejemplo.com).",
    };
  }

  return { ok: true, url: u.toString() };
}
