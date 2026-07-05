import type { InputType, RecommendedFlow, Verdict } from "@/lib/constants";
import type { ThreatIntelligenceResult } from "@/lib/threat-intelligence";

/**
 * Capa de agente de IA (Gemini o mock).
 *
 * Regla de privacidad por diseño: el agente NUNCA recibe el archivo ni su
 * contenido. `ReportInput` solo transporta metadatos, puntuaciones, señales
 * e indicadores ya enmascarados. Esta restricción está garantizada por
 * construcción: no existe ningún campo para el contenido.
 */

export interface AgentChatContext {
  tenantName: string;
  sector: string;
  userName: string;
}

export interface ChatTurn {
  role: "user" | "agent";
  content: string;
}

export interface ReportInput {
  inputType: InputType;
  originalName?: string | null;
  /** URL analizada o descripción breve (nunca contenido del archivo). */
  inputValue?: string | null;
  sha256?: string | null;
  realTypeLabel?: string | null;
  fileSize?: number | null;
  threatScore: number;
  sensitivityScore: number;
  recommendedFlow: RecommendedFlow;
  verdict: Verdict;
  reason: string;
  privacyExplanation: string;
  securityExplanation: string;
  threatSignals: string[];
  sensitivitySignals: string[];
  /** Indicadores ya enmascarados (DNI, IBAN, teléfonos, emails). */
  indicators: { type: string; value: string; risk: string }[];
  ti: ThreatIntelligenceResult;
  tenantName: string;
  sector: string;
  mockMode: boolean;
}

export interface GeneratedReports {
  employeeReport: string;
  adminReport: string;
  finalRecommendation: string;
  stepsForEmployee: string[];
}

export interface AgentProvider {
  readonly name: string;
  chat(turns: ChatTurn[], ctx: AgentChatContext): Promise<string>;
  generateReports(input: ReportInput): Promise<GeneratedReports>;
}
