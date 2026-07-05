import { env } from "@/lib/env";
import { GeminiProvider } from "./gemini";
import { MockAgentProvider } from "./mock";
import type { AgentProvider } from "./types";

export * from "./types";
export { MockAgentProvider } from "./mock";
export { GeminiProvider } from "./gemini";

/**
 * Selección de proveedor de IA:
 * - Gemini si hay GEMINI_API_KEY (con degradación automática a mock ante error);
 * - mock en caso contrario.
 */
export function getAgentProvider(): AgentProvider {
  if (env.agentIsMock) {
    return new MockAgentProvider();
  }
  return new GeminiProvider();
}
