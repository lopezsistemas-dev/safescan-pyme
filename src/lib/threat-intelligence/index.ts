import { env } from "@/lib/env";
import { MockThreatIntelligenceProvider } from "./mock";
import { VirusTotalProvider } from "./virustotal";
import type { ThreatIntelligenceProvider } from "./types";

export * from "./types";
export { MockThreatIntelligenceProvider } from "./mock";
export { VirusTotalProvider } from "./virustotal";

/**
 * Selección de proveedor:
 * - mock si MOCK_SECURITY_ANALYSIS=true o si no hay VIRUSTOTAL_API_KEY;
 * - VirusTotal real en caso contrario.
 */
export function getThreatIntelligenceProvider(): ThreatIntelligenceProvider {
  if (env.threatIntelIsMock) {
    return new MockThreatIntelligenceProvider();
  }
  return new VirusTotalProvider(env.VIRUSTOTAL_API_KEY, env.VIRUSTOTAL_PRIVATE_SCANNING_ENABLED);
}
