import type { InputType, RecommendedFlow } from "@/lib/constants";
import type { TenantPolicy } from "@/lib/tenant";
import type { ContainmentResult } from "@/lib/containment";

/**
 * Policy & Privacy Engine.
 *
 * Evalúa cada entrada en dos dimensiones independientes:
 *  - threatScore (0-100): probabilidad de que sea una amenaza.
 *  - sensitivityScore (0-100): sensibilidad del contenido (datos personales,
 *    bancarios, de salud…).
 *
 * Y decide el flujo de análisis adecuado. Regla central del producto:
 * no todos los archivos deben analizarse igual — la privacidad durante
 * el análisis también es ciberseguridad.
 *
 * Motor determinista y explicable: cada punto sumado deja una señal
 * legible que después se muestra en los informes.
 */

export interface PolicyInput {
  inputType: InputType;
  originalName?: string | null;
  fileSize?: number | null;
  containment: ContainmentResult;
  policy: TenantPolicy;
  /** Capacidad real de Private Scanning (VIRUSTOTAL_PRIVATE_SCANNING_ENABLED). */
  privateScanningEnabled: boolean;
}

export interface PolicyResult {
  threatScore: number;
  sensitivityScore: number;
  recommendedFlow: RecommendedFlow;
  reason: string;
  privacyExplanation: string;
  securityExplanation: string;
  threatSignals: string[];
  sensitivitySignals: string[];
}

const cap = (n: number) => Math.min(100, Math.round(n));

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  const { containment, policy } = input;
  const { extraction, fileType, archive, urgencyInName } = containment;
  const { counts, flags } = extraction;

  // ── Threat Score ────────────────────────────────────────────────────────
  let threat = 0;
  const threatSignals: string[] = [];
  const addThreat = (points: number, signal: string) => {
    threat += points;
    threatSignals.push(signal);
  };

  if (fileType?.isExecutable) addThreat(55, "Archivo ejecutable: puede instalar malware al abrirse");
  if (fileType?.doubleExtension)
    addThreat(
      30,
      `Doble extensión: se hace pasar por .${fileType.doubleExtension.disguisedAs} pero es .${fileType.doubleExtension.actual}`
    );
  if (fileType?.mismatch)
    addThreat(25, "El contenido real del archivo no coincide con su extensión declarada");
  if (fileType?.hasMacroExtension)
    addThreat(35, "Documento de Office con macros: puede ejecutar código al abrirse");
  if (fileType?.isArchive)
    addThreat(20, "Archivo comprimido: puede ocultar ejecutables u otro contenido peligroso");
  if (archive?.containsExecutable)
    addThreat(55, "El comprimido contiene al menos un archivo ejecutable");
  if (archive?.doubleExtensionEntry)
    addThreat(
      30,
      `Dentro del comprimido hay un ejecutable camuflado con doble extensión (${archive.doubleExtensionEntry})`
    );
  if (flags.hasShortener) addThreat(25, "Enlace acortado: oculta el destino real");
  if (flags.hasSuspiciousDomain) addThreat(35, "Dominio con TLD de riesgo, típico de campañas de phishing");
  if (flags.hasIpHost) addThreat(25, "Enlace que apunta a una IP directa en lugar de a un dominio");
  if (flags.hasPunycode) addThreat(20, "Dominio con punycode: posible suplantación visual de marca");
  if (flags.hasHttpNoTls) addThreat(10, "Conexión sin cifrar (http://)");
  if (flags.hasUrgencyLexicon) addThreat(15, "Léxico de presión o urgencia, habitual en ingeniería social");
  if (urgencyInName) addThreat(10, "El nombre del archivo transmite urgencia");
  if (counts.urls >= 3) addThreat(10, `Contiene ${counts.urls} enlaces`);

  // Suelo de riesgo: un documento con macros nunca se considera de riesgo
  // bajo (es el vector de entrada más común en pymes)
  if (fileType?.hasMacroExtension && threat < 60) {
    threatSignals.push("Los documentos con macros se tratan siempre como riesgo alto por política");
    threat = 60;
  }

  // ── Sensitivity Score ───────────────────────────────────────────────────
  let sens = 0;
  const sensitivitySignals: string[] = [];
  const addSens = (points: number, signal: string) => {
    sens += points;
    sensitivitySignals.push(signal);
  };

  if (counts.dnis > 0) addSens(35, `DNI/NIE detectado (${counts.dnis})`);
  if (counts.ibans > 0) addSens(30, `IBAN detectado (${counts.ibans})`);
  if (counts.phones >= 3) addSens(15, `Múltiples teléfonos personales (${counts.phones})`);
  else if (counts.phones > 0) addSens(10, `Teléfono personal detectado`);
  if (counts.emails >= 3) addSens(15, `Múltiples emails personales (${counts.emails})`);
  else if (counts.emails > 0) addSens(5, `Email personal detectado`);
  if (counts.keywords > 0)
    addSens(
      Math.min(40, counts.keywords * 8),
      `Palabras sensibles del negocio: ${extraction.matchedKeywords.slice(0, 5).join(", ")}`
    );
  if (flags.hasHealthData) addSens(20, "Datos de salud: categoría especialmente protegida (RGPD)");

  const nameNorm = (input.originalName ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/(factura|contrato|nomina|reserva|cliente|paciente|presupuesto)/.test(nameNorm))
    addSens(10, "El nombre del archivo sugiere documento de negocio");

  const threatScore = cap(threat);
  const sensitivityScore = cap(sens);

  // ── Decisión de flujo ───────────────────────────────────────────────────
  const threatening = threatScore >= policy.umbralAmenaza;
  const sensitive = sensitivityScore >= policy.umbralSensibilidad;
  const psAvailable = input.privateScanningEnabled || policy.privateScanningPreferido;

  let flow: RecommendedFlow;
  let reason: string;

  if (input.inputType === "URL") {
    flow = "URL_LOOKUP";
    reason = "Se analiza la reputación de la URL y su dominio; no se expone ningún documento.";
  } else if (input.inputType === "EMAIL_TEXT") {
    if (counts.urls > 0) {
      flow = "URL_LOOKUP";
      reason = "El correo contiene enlaces: se analiza su reputación sin exponer el contenido del mensaje.";
    } else if (threatening) {
      flow = "HUMAN_REVIEW";
      reason = "El correo presenta señales de ingeniería social sin enlaces analizables: requiere criterio humano.";
    } else {
      flow = "LOCAL_ONLY";
      reason = "El correo se evalúa solo con heurísticas locales; no hay indicadores que consultar externamente.";
    }
  } else if (
    (fileType?.isExecutable || fileType?.doubleExtension || archive?.containsExecutable) &&
    policy.bloquearEjecutables
  ) {
    flow = "QUARANTINE";
    reason =
      "Ejecutable o ejecutable camuflado: la política de la empresa lo bloquea directamente en cuarentena.";
  } else if (threatScore >= 85) {
    flow = "QUARANTINE";
    reason = "Riesgo de amenaza extremo: el archivo queda contenido en cuarentena.";
  } else if (sensitive && threatening) {
    flow = psAvailable ? "PRIVATE_SCANNING" : "HUMAN_REVIEW";
    reason = psAvailable
      ? "Documento sensible y sospechoso a la vez: se prioriza el análisis privado (Private Scanning)."
      : "Documento sensible y sospechoso a la vez: sin Private Scanning disponible, se escala a revisión humana.";
  } else if (sensitivityScore >= 80) {
    flow = input.privateScanningEnabled ? "PRIVATE_SCANNING" : "HUMAN_REVIEW";
    reason = input.privateScanningEnabled
      ? "Sensibilidad muy alta: el análisis se realiza por el flujo privado autorizado."
      : "Sensibilidad muy alta: el contenido no debe salir del entorno; se analiza en local y se escala al responsable.";
  } else if (sensitive) {
    flow = psAvailable ? "PRIVATE_SCANNING" : "LOCAL_ONLY";
    reason = psAvailable
      ? "Documento sensible: la política de la empresa prioriza el flujo de análisis privado."
      : "Documento sensible sin señales de amenaza relevantes: análisis exclusivamente local.";
  } else {
    flow = "HASH_LOOKUP";
    reason = threatening
      ? "Se consulta la reputación del hash: permite verificar la amenaza sin exponer el contenido."
      : "Sin contenido sensible: basta con consultar la reputación de la huella digital (hash).";
  }

  // ── Explicaciones ───────────────────────────────────────────────────────
  const securityExplanation =
    threatSignals.length > 0
      ? `Señales de amenaza detectadas: ${threatSignals.slice(0, 4).join("; ")}.`
      : "No se han detectado señales de amenaza relevantes.";

  const privacyExplanation =
    sensitivitySignals.length > 0
      ? `El contenido presenta datos sensibles (${sensitivitySignals
          .slice(0, 3)
          .join("; ")}). ${
          flow === "PRIVATE_SCANNING"
            ? "Se aplica el flujo privado: sin subida a corpus público ni compartición con terceros."
            : flow === "LOCAL_ONLY" || flow === "HUMAN_REVIEW"
              ? "El contenido no sale del entorno de la empresa durante el análisis."
              : "Solo se consultan huellas digitales o reputación; el contenido nunca se envía."
        }`
      : "El contenido no presenta datos sensibles; el análisis no expone información de la empresa.";

  return {
    threatScore,
    sensitivityScore,
    recommendedFlow: flow,
    reason,
    privacyExplanation,
    securityExplanation,
    threatSignals,
    sensitivitySignals,
  };
}
