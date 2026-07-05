import { FLOW_DESCRIPTIONS, FLOW_LABELS, VERDICT_LABELS } from "@/lib/constants";
import type {
  AgentChatContext,
  AgentProvider,
  ChatTurn,
  GeneratedReports,
  ReportInput,
} from "./types";

/**
 * Agente mock: respuestas guiadas por plantillas e intenciones.
 * Permite que el MVP funcione completo sin clave de Gemini, con el mismo
 * tono y estructura que tendría el agente real.
 */

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Chat ──────────────────────────────────────────────────────────────────

export function mockChatReply(turns: ChatTurn[], ctx: AgentChatContext): string {
  const last = normalize(turns.filter((t) => t.role === "user").at(-1)?.content ?? "");

  if (!last || includesAny(last, ["hola", "buenas", "buenos dias", "buenas tardes", "hey"])) {
    return `Hola, ${ctx.userName}. Soy el agente de seguridad de ${ctx.tenantName}. ¿Qué has recibido? Puedes subir un archivo con el clip 📎, pegar un enlace o contarme qué correo te ha llegado. Recuerda: no abras nada hasta que lo analicemos.`;
  }

  if (includesAny(last, ["gracias", "genial", "perfecto", "vale", "ok"])) {
    return `De nada. Recuerda la regla de oro: pregunta antes de abrir. Aquí estaré cuando recibas algo dudoso.`;
  }

  if (includesAny(last, ["unir", "juntar", "separar", "dividir", "rotar", "metadatos", "comprimir pdf", "safedocs", "editar pdf"])) {
    return `Para trabajar con documentos cotidianos sin usar webs externas tienes **SafeDocs**: unir PDFs, extraer páginas, rotar y limpiar metadatos, todo dentro del entorno privado de ${ctx.tenantName}. Lo encuentras en la sección SafeDocs del menú. SafeScan protege documentos sospechosos; SafeDocs protege documentos cotidianos.`;
  }

  if (includesAny(last, ["enlace", "link", "url", "http", "www.", "pagar", "pago urgente"])) {
    return `No pulses ese enlace todavía. Pégalo aquí en el chat (usa la pestaña «URL») y lo analizaré: comprobaré el dominio, su reputación y las señales de phishing. Analizar una URL no expone ningún documento de la empresa.`;
  }

  if (includesAny(last, ["correo", "email", "mensaje", "remitente", "phishing", "asunto"])) {
    return `Entendido. Copia el texto del correo (o descríbemelo) en la pestaña «Correo» y lo evaluaré: buscaré enlaces, señales de presión y suplantación. No respondas al remitente ni descargues adjuntos hasta que terminemos.`;
  }

  if (includesAny(last, ["zip", "factura", "excel", "adjunto", "archivo", "documento", "pdf", "word", "descargar", "abrir"])) {
    return `No lo abras todavía. Súbelo con el clip 📎 y lo analizaré en el entorno seguro de ${ctx.tenantName}: lo mantendré en cuarentena, comprobaré su tipo real, buscaré señales de amenaza y revisaré si contiene datos sensibles. En unos segundos tendrás una recomendación clara: abrir, bloquear o escalar.`;
  }

  if (includesAny(last, ["datos", "cliente", "dni", "iban", "sensible", "privacidad", "confidencial"])) {
    return `Buena pregunta. En SafeScan cada archivo se trata como posible amenaza y como posible activo sensible. Si el documento contiene DNI, IBAN o datos de clientes, aplicaré el flujo privado adecuado: la privacidad durante el análisis también es ciberseguridad. Súbelo y decido el flujo por ti.`;
  }

  return `Estoy aquí para ayudarte a decidir antes de abrir. Puedes: subir un archivo sospechoso 📎, pegar un enlace en la pestaña «URL», o describir un correo en la pestaña «Correo». También tienes SafeDocs para manipular PDFs cotidianos de forma privada. ¿Qué has recibido?`;
}

// ── Informes ──────────────────────────────────────────────────────────────

function subjectOf(input: ReportInput): string {
  if (input.inputType === "URL") return "el enlace";
  if (input.inputType === "EMAIL_TEXT") return "el correo";
  return input.originalName ? `«${input.originalName}»` : "el archivo";
}

function whatHappened(input: ReportInput): string {
  const parts: string[] = [];
  if (input.threatSignals.length > 0) {
    parts.push(input.securityExplanation);
  } else {
    parts.push(`No se han encontrado señales de amenaza en ${subjectOf(input)}.`);
  }
  if (input.sensitivitySignals.length > 0) {
    parts.push(input.privacyExplanation);
  }
  return parts.join(" ");
}

export function stepsForEmployee(input: ReportInput): string[] {
  switch (input.verdict) {
    case "BLOQUEAR":
      return [
        `No abras ${subjectOf(input)} bajo ningún concepto.`,
        "No lo reenvíes ni lo descargues de nuevo.",
        "No respondas al remitente.",
        "Tu responsable ha sido notificado con el informe técnico.",
        "Si ya lo habías abierto, desconecta el equipo de la red y avisa inmediatamente.",
      ];
    case "CUARENTENA":
      return [
        `${subjectOf(input).charAt(0).toUpperCase()}${subjectOf(input).slice(1)} queda retenido en cuarentena: no puede abrirse por accidente.`,
        "No intentes descargarlo de nuevo desde el correo original.",
        "Espera la decisión del responsable antes de hacer nada más.",
      ];
    case "ESCALAR":
      return [
        `No abras ${subjectOf(input)} todavía.`,
        "Tu responsable ha recibido el informe completo y decidirá el siguiente paso.",
        "Si conoces al remitente, verifica por otro canal (teléfono) que el envío es real.",
        "No reenvíes el documento mientras tanto.",
      ];
    case "ABRIR_CON_PRECAUCION":
      return [
        "Puedes abrirlo, pero con precaución.",
        "No actives macros ni «habilitar contenido» si el documento lo pide.",
        "No introduzcas contraseñas ni datos bancarios si te los solicita.",
        "Si algo te resulta raro al abrirlo, ciérralo y vuelve a consultarme.",
      ];
    default:
      return [
        "Puedes abrirlo con normalidad: no se han encontrado señales de riesgo.",
        "Aun así, si algo te resulta extraño, vuelve a consultarme.",
      ];
  }
}

function adviceFor(input: ReportInput): string {
  if (input.threatSignals.some((s) => s.toLowerCase().includes("doble extensión")))
    return "Una factura o documento real nunca llega como programa ejecutable. Fíjate siempre en la extensión final del archivo.";
  if (input.threatSignals.some((s) => s.toLowerCase().includes("macros")))
    return "Un documento normal no necesita macros. Si un Excel o Word te pide «habilitar contenido», desconfía.";
  if (input.threatSignals.some((s) => s.toLowerCase().includes("acortado")))
    return "Los enlaces acortados ocultan su destino real. Ante un pago o una contraseña, escribe tú la dirección oficial en el navegador.";
  if (input.inputType === "URL")
    return "Comprueba siempre el dominio real antes de pagar o introducir datos: los atacantes imitan páginas legítimas con dominios parecidos.";
  if (input.sensitivityScore >= 60)
    return "Para manipular documentos con datos de clientes (unir, separar, limpiar metadatos), usa SafeDocs: todo queda dentro del entorno privado de la empresa.";
  return "Ante la duda, pregunta antes de abrir. Ese momento de consulta es el que evita la mayoría de incidentes.";
}

export function buildEmployeeReport(input: ReportInput): string {
  const dontDo =
    input.verdict === "ABRIR"
      ? "No hace falta ninguna precaución especial, pero no compartas el documento fuera de la empresa si contiene datos internos."
      : input.verdict === "ABRIR_CON_PRECAUCION"
        ? "No actives macros, no pulses enlaces internos del documento y no introduzcas credenciales."
        : "No lo abras, no lo reenvíes y no respondas al remitente.";

  return [
    `**Resultado: ${VERDICT_LABELS[input.verdict]}**`,
    "",
    `**Qué ha pasado:** ${whatHappened(input)}`,
    "",
    `**Qué debes hacer:**`,
    ...stepsForEmployee(input).map((s) => `- ${s}`),
    "",
    `**Qué no debes hacer:** ${dontDo}`,
    "",
    `**Privacidad durante el análisis:** ${input.privacyExplanation}`,
    "",
    `**Consejo:** ${adviceFor(input)}`,
  ].join("\n");
}

export function buildAdminReport(input: ReportInput): string {
  const lines: string[] = [
    `## Informe técnico — ${input.originalName ?? input.inputValue ?? "análisis"}`,
    "",
  ];

  if (input.sha256) lines.push(`- **SHA-256:** ${input.sha256}`);
  if (input.inputValue && input.inputType === "URL")
    lines.push(`- **URL analizada:** ${input.inputValue.replace(/^http/, "hxxp").replace(/\./g, "[.]").slice(0, 160)} (desactivada)`);
  if (input.realTypeLabel) lines.push(`- **Tipo real detectado:** ${input.realTypeLabel}`);
  if (input.fileSize) lines.push(`- **Tamaño:** ${formatBytes(input.fileSize)}`);
  lines.push(`- **Threat Score:** ${input.threatScore}/100 · **Sensitivity Score:** ${input.sensitivityScore}/100`);
  lines.push(`- **Veredicto:** ${VERDICT_LABELS[input.verdict]}`);
  lines.push(`- **Flujo aplicado:** ${FLOW_LABELS[input.recommendedFlow]} — ${FLOW_DESCRIPTIONS[input.recommendedFlow]}`);
  lines.push(`- **Motivo de la decisión:** ${input.reason}`);

  if (input.threatSignals.length > 0) {
    lines.push("", "### Señales de amenaza");
    lines.push(...input.threatSignals.map((s) => `- ${s}`));
  }
  if (input.sensitivitySignals.length > 0) {
    lines.push("", "### Señales de sensibilidad");
    lines.push(...input.sensitivitySignals.map((s) => `- ${s}`));
  }
  if (input.indicators.length > 0) {
    lines.push("", "### Indicadores extraídos (valores sensibles enmascarados)");
    lines.push(...input.indicators.slice(0, 12).map((i) => `- [${i.risk}] ${i.type}: ${i.value}`));
  }

  lines.push(
    "",
    "### Inteligencia de amenazas",
    `- **Proveedor:** ${input.ti.providerUsed}${input.mockMode ? " · modo mock" : ""}`,
    `- **Veredicto TI:** ${input.ti.verdict} · **Detecciones:** ${input.ti.detections} · **Reputación:** ${input.ti.reputation}`,
    input.ti.matchedThreats.length > 0
      ? `- **Amenazas identificadas:** ${input.ti.matchedThreats.join(", ")}`
      : "- **Amenazas identificadas:** ninguna",
    `- **Private Scanning:** ${input.ti.privateScanningUsed ? "sí (simulado en el MVP)" : "no utilizado"}`,
    "",
    "### Privacidad y trazabilidad",
    `- ${input.privacyExplanation}`,
    "- El agente de IA solo recibió metadatos, puntuaciones y señales enmascaradas: nunca el contenido del documento.",
    "- Todas las acciones quedan registradas en el log de auditoría de la empresa.",
    "",
    "### Recomendación",
    `- ${finalRecommendationFor(input)}`
  );

  return lines.join("\n");
}

export function finalRecommendationFor(input: ReportInput): string {
  switch (input.verdict) {
    case "BLOQUEAR":
      return `Bloquear ${subjectOf(input)}, mantenerlo en cuarentena hasta su eliminación y avisar al equipo del patrón detectado.`;
    case "CUARENTENA":
      return `Mantener ${subjectOf(input)} en cuarentena hasta verificar el origen por un canal alternativo.`;
    case "ESCALAR":
      return `Revisar el caso personalmente: verificar el remitente por otro canal y decidir entre autorizar la apertura o bloquear definitivamente.`;
    case "ABRIR_CON_PRECAUCION":
      return `Autorizar la apertura con las precauciones indicadas al empleado (sin macros, sin credenciales).`;
    default:
      return `Sin acción necesaria: el análisis no encontró señales de riesgo ni exposición.`;
  }
}

export class MockAgentProvider implements AgentProvider {
  readonly name = "MockAgentProvider";

  async chat(turns: ChatTurn[], ctx: AgentChatContext): Promise<string> {
    return mockChatReply(turns, ctx);
  }

  async generateReports(input: ReportInput): Promise<GeneratedReports> {
    return {
      employeeReport: buildEmployeeReport(input),
      adminReport: buildAdminReport(input),
      finalRecommendation: finalRecommendationFor(input),
      stepsForEmployee: stepsForEmployee(input),
    };
  }
}
