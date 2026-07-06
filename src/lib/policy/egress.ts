import type { RecommendedFlow } from "@/lib/constants";

/**
 * "Recibo de privacidad" por análisis: a partir del flujo aplicado y del tipo
 * de entrada, deriva qué salió del entorno de la empresa y qué NUNCA salió.
 *
 * Materializa la tesis del producto ("la privacidad durante el análisis también
 * es ciberseguridad") en evidencia auditable, usando datos que ya existen y ya
 * se persisten (recommendedFlow, inputType, mockMode). Función pura y determinista.
 */

export interface EgressItem {
  label: string;
  detail: string;
}

export interface DataEgress {
  /** Qué salió (o se consultaría) fuera del entorno de la empresa. */
  left: EgressItem[];
  /** Qué NUNCA salió del entorno. */
  neverLeft: EgressItem[];
  /** El envío externo fue simulado (modo mock) o el flujo se simula en el MVP. */
  simulated: boolean;
  /** Frase resumen del recibo. */
  summary: string;
}

export function dataEgressFor(params: {
  inputType: string;
  flow: RecommendedFlow | null;
  mockMode: boolean;
}): DataEgress {
  const { inputType, flow, mockMode } = params;
  const isFile = inputType === "FILE";
  const isEmail = inputType === "EMAIL_TEXT";

  // Lo que NUNCA sale, sea cual sea el flujo (garantía por construcción)
  const neverLeft: EgressItem[] = [];
  if (isFile) {
    neverLeft.push({
      label: "Contenido del archivo",
      detail: "No se abre, no se ejecuta y no se sube a ningún servicio externo.",
    });
  }
  if (isEmail) {
    neverLeft.push({
      label: "Texto del correo en claro",
      detail: "Se analiza en local; a la IA solo llega una versión con la PII enmascarada.",
    });
  }
  neverLeft.push({
    label: "Datos personales sin enmascarar",
    detail: "DNI/NIE, IBAN, teléfonos y correos se enmascaran antes de cualquier consulta o registro.",
  });

  const left: EgressItem[] = [];
  let simulated = mockMode;

  switch (flow) {
    case "HASH_LOOKUP":
      left.push({
        label: "Huella digital SHA-256",
        detail: "Se consulta la reputación de la huella del archivo, no su contenido.",
      });
      break;
    case "URL_LOOKUP":
      left.push({
        label: "URL y dominio",
        detail: "Se consulta la reputación del enlace y su dominio. No se envía ningún documento.",
      });
      break;
    case "PRIVATE_SCANNING":
      // En el MVP este flujo se simula: el documento no sale realmente.
      simulated = true;
      neverLeft.push({
        label: "Documento (Private Scanning)",
        detail: "El análisis privado se simula en el MVP: no se sube a ningún corpus público.",
      });
      break;
    case "LOCAL_ONLY":
    case "HUMAN_REVIEW":
    case "QUARANTINE":
    default:
      // Nada sale del entorno.
      break;
  }

  const labels = left.map((i) => i.label.toLowerCase()).join(" y ");
  const summary =
    left.length === 0
      ? "Nada salió del entorno de la empresa: el análisis fue completamente local."
      : simulated
        ? `Solo ${labels} se consultaría a un servicio de reputación (simulado de forma determinista en el MVP).`
        : `Solo ${labels} salió hacia el servicio de reputación externo.`;

  return { left, neverLeft, simulated, summary };
}
