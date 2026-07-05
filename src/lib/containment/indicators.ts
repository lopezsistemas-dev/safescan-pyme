import type { IndicatorType, RiskLevel } from "@/lib/constants";

/**
 * Extracción de indicadores sobre texto: URLs, dominios, emails, teléfonos,
 * IBAN, DNI/NIE y palabras sensibles.
 *
 * Privacidad por diseño: los valores personales (DNI, IBAN, teléfono, email)
 * se guardan SIEMPRE enmascarados. El valor completo nunca se persiste ni se
 * envía a ningún servicio externo.
 */

export interface ExtractedIndicator {
  type: IndicatorType;
  value: string;
  risk: RiskLevel;
}

export interface IndicatorFlags {
  hasShortener: boolean;
  hasSuspiciousDomain: boolean;
  hasHttpNoTls: boolean;
  hasIpHost: boolean;
  hasPunycode: boolean;
  hasUrgencyLexicon: boolean;
  hasHealthData: boolean;
}

export interface IndicatorCounts {
  urls: number;
  domains: number;
  emails: number;
  phones: number;
  ibans: number;
  dnis: number;
  keywords: number;
}

export interface IndicatorExtraction {
  indicators: ExtractedIndicator[];
  counts: IndicatorCounts;
  flags: IndicatorFlags;
  matchedKeywords: string[];
}

const SHORTENER_DOMAINS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "cutt.ly",
  "rebrand.ly", "shorturl.at", "rb.gy", "buff.ly", "s.id", "tiny.cc",
]);

const SUSPICIOUS_TLDS = new Set([
  "top", "xyz", "zip", "mov", "click", "link", "gq", "tk", "ml", "cf",
  "work", "rest", "cam", "loan", "country", "stream", "download",
]);

export const SENSITIVE_KEYWORDS = [
  "factura", "contrato", "nómina", "nomina", "reserva", "cliente",
  "proveedor", "banco", "pago", "transferencia", "firma", "dni", "iban",
  "confidencial", "presupuesto", "póliza", "poliza", "expediente",
];

export const HEALTH_KEYWORDS = [
  "paciente", "historia clínica", "historia clinica", "diagnóstico",
  "diagnostico", "tratamiento", "receta", "informe médico", "informe medico",
];

export const URGENCY_LEXICON = [
  "urgente", "inmediatamente", "verificar", "verifique", "bloqueada",
  "bloqueado", "suspendida", "suspendido", "premio", "hacienda",
  "agencia tributaria", "paquete retenido", "último aviso", "ultimo aviso",
  "caduca", "24 horas", "pago pendiente", "factura vencida",
  "cuenta bloqueada", "confirme sus datos", "haga clic", "pulse aquí", "pulse aqui",
];

// ── Enmascaramiento (privacidad por diseño) ──────────────────────────────

export function maskDni(value: string): string {
  const v = value.replace(/[\s-]/g, "");
  return `${v.slice(0, 2)}*****${v.slice(-1)}`;
}

export function maskIban(value: string): string {
  const v = value.replace(/[\s-]/g, "");
  return `${v.slice(0, 4)} **** **** ${v.slice(-4)}`;
}

export function maskPhone(value: string): string {
  const v = value.replace(/[\s.-]/g, "");
  return `${v.slice(0, 2)}** *** ${v.slice(-2)}`;
}

export function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}

// ── Validaciones ─────────────────────────────────────────────────────────

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Valida la letra de control de DNI (8 dígitos + letra) y NIE (X/Y/Z). */
export function isValidDniNie(value: string): boolean {
  const v = value.toUpperCase().replace(/[\s-]/g, "");
  const dni = /^(\d{8})([A-Z])$/.exec(v);
  if (dni) return DNI_LETTERS[parseInt(dni[1], 10) % 23] === dni[2];
  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(v);
  if (nie) {
    const prefix = { X: "0", Y: "1", Z: "2" }[nie[1] as "X" | "Y" | "Z"];
    return DNI_LETTERS[parseInt(prefix + nie[2], 10) % 23] === nie[3];
  }
  return false;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function tldOf(domain: string): string {
  const parts = domain.split(".");
  return parts[parts.length - 1] || "";
}

const MAX_PER_TYPE = 8;

/**
 * Extrae indicadores de un texto. `extraKeywords` permite añadir las
 * palabras sensibles propias de la política de cada empresa.
 */
export function extractIndicatorsFromText(
  text: string,
  extraKeywords: string[] = []
): IndicatorExtraction {
  const indicators: ExtractedIndicator[] = [];
  const flags: IndicatorFlags = {
    hasShortener: false,
    hasSuspiciousDomain: false,
    hasHttpNoTls: false,
    hasIpHost: false,
    hasPunycode: false,
    hasUrgencyLexicon: false,
    hasHealthData: false,
  };

  const clipped = text.slice(0, 300_000);
  const norm = normalize(clipped);

  // URLs y dominios
  const urlMatches = Array.from(
    new Set((clipped.match(/\bhttps?:\/\/[^\s<>"'()\]]+/gi) ?? []).map((u) => u.replace(/[.,;:]+$/, "")))
  );
  const domains = new Set<string>();
  for (const url of urlMatches) {
    const domain = domainOf(url);
    if (!domain) continue;
    domains.add(domain);
    const isShortener = SHORTENER_DOMAINS.has(domain);
    const isSuspiciousTld = SUSPICIOUS_TLDS.has(tldOf(domain));
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(domain);
    const isPunycode = domain.includes("xn--");
    const isHttp = url.toLowerCase().startsWith("http://");
    if (isShortener) flags.hasShortener = true;
    if (isSuspiciousTld) flags.hasSuspiciousDomain = true;
    if (isIp) flags.hasIpHost = true;
    if (isPunycode) flags.hasPunycode = true;
    if (isHttp) flags.hasHttpNoTls = true;

    const risky = isShortener || isSuspiciousTld || isIp || isPunycode;
    if (indicators.filter((i) => i.type === "URL").length < MAX_PER_TYPE) {
      indicators.push({
        type: "URL",
        value: url.slice(0, 200),
        risk: risky ? "ALTO" : isHttp ? "MEDIO" : "BAJO",
      });
    }
  }
  for (const domain of Array.from(domains).slice(0, MAX_PER_TYPE)) {
    const risky =
      SHORTENER_DOMAINS.has(domain) ||
      SUSPICIOUS_TLDS.has(tldOf(domain)) ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(domain) ||
      domain.includes("xn--");
    indicators.push({ type: "DOMAIN", value: domain, risk: risky ? "ALTO" : "BAJO" });
  }

  // Emails (enmascarados)
  const emailMatches = Array.from(
    new Set(clipped.match(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi) ?? [])
  );
  for (const email of emailMatches.slice(0, MAX_PER_TYPE)) {
    indicators.push({ type: "EMAIL", value: maskEmail(email), risk: "MEDIO" });
  }

  // Teléfonos españoles (enmascarados)
  const phoneMatches = Array.from(
    new Set(
      clipped.match(/(?:(?:\+|00)34[\s.-]?)?\b[679]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g) ?? []
    )
  );
  for (const phone of phoneMatches.slice(0, MAX_PER_TYPE)) {
    indicators.push({ type: "PHONE", value: maskPhone(phone), risk: "MEDIO" });
  }

  // IBAN (enmascarados)
  const ibanMatches = Array.from(
    new Set(
      (clipped.match(/\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]{4}){3,7}(?:[\s-]?[A-Z0-9]{1,4})?\b/g) ?? []).filter(
        (m) => {
          const compact = m.replace(/[\s-]/g, "");
          return compact.length >= 15 && compact.length <= 34;
        }
      )
    )
  );
  for (const iban of ibanMatches.slice(0, MAX_PER_TYPE)) {
    indicators.push({ type: "IBAN", value: maskIban(iban), risk: "ALTO" });
  }

  // DNI / NIE con letra de control válida (enmascarados)
  const dniCandidates = Array.from(
    new Set(clipped.toUpperCase().match(/\b(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/g) ?? [])
  ).filter(isValidDniNie);
  for (const dni of dniCandidates.slice(0, MAX_PER_TYPE)) {
    indicators.push({ type: "DNI", value: maskDni(dni), risk: "ALTO" });
  }

  // Palabras sensibles (base + política del tenant)
  const allKeywords = [...SENSITIVE_KEYWORDS, ...extraKeywords.map((k) => k.toLowerCase())];
  const matchedKeywords = Array.from(
    new Set(allKeywords.filter((k) => norm.includes(normalize(k))))
  );
  for (const kw of matchedKeywords.slice(0, MAX_PER_TYPE)) {
    indicators.push({ type: "KEYWORD", value: `Palabra sensible: “${kw}”`, risk: "MEDIO" });
  }

  const healthMatches = HEALTH_KEYWORDS.filter((k) => norm.includes(normalize(k)));
  if (healthMatches.length > 0) {
    flags.hasHealthData = true;
    indicators.push({
      type: "KEYWORD",
      value: `Datos de salud detectados (${healthMatches.slice(0, 3).join(", ")})`,
      risk: "ALTO",
    });
  }

  const urgencyMatches = URGENCY_LEXICON.filter((k) => norm.includes(normalize(k)));
  if (urgencyMatches.length > 0) {
    flags.hasUrgencyLexicon = true;
    indicators.push({
      type: "KEYWORD",
      value: `Léxico de presión: ${urgencyMatches.slice(0, 4).map((u) => `“${u}”`).join(", ")}`,
      risk: "MEDIO",
    });
  }

  return {
    indicators,
    counts: {
      urls: urlMatches.length,
      domains: domains.size,
      emails: emailMatches.length,
      phones: phoneMatches.length,
      ibans: ibanMatches.length,
      dnis: dniCandidates.length,
      keywords: matchedKeywords.length,
    },
    flags,
    matchedKeywords,
  };
}

/** Extracción vacía (para archivos de los que no se puede leer texto). */
export function emptyExtraction(): IndicatorExtraction {
  return {
    indicators: [],
    counts: { urls: 0, domains: 0, emails: 0, phones: 0, ibans: 0, dnis: 0, keywords: 0 },
    flags: {
      hasShortener: false,
      hasSuspiciousDomain: false,
      hasHttpNoTls: false,
      hasIpHost: false,
      hasPunycode: false,
      hasUrgencyLexicon: false,
      hasHealthData: false,
    },
    matchedKeywords: [],
  };
}
