/**
 * Capa de inteligencia de amenazas (VirusTotal / Google Threat Intelligence).
 *
 * La interfaz es común: el MVP funciona con un proveedor mock realista y
 * el conector VirusTotal queda preparado para usar la API real cuando
 * exista clave y acuerdo autorizado.
 */

export type TIVerdict = "clean" | "suspicious" | "malicious" | "unknown";

export interface ThreatIntelligenceResult {
  verdict: TIVerdict;
  /** Detecciones con formato "N/M motores". */
  detections: string;
  /** Reputación de -100 (maliciosa) a 100 (confiable). */
  reputation: number;
  matchedThreats: string[];
  explanation: string;
  providerUsed: string;
  privateScanningUsed: boolean;
  rawTechnicalSummary: string;
}

/** Pistas locales que el mock usa para generar veredictos coherentes. */
export interface AnalysisHints {
  threatScore?: number;
  threatSignals?: string[];
  originalName?: string | null;
}

export interface FileMetadataForScanning {
  originalName: string;
  sha256: string;
  size: number;
  realTypeLabel: string;
}

export interface ThreatIntelligenceProvider {
  readonly name: string;
  analyzeHash(hash: string, hints?: AnalysisHints): Promise<ThreatIntelligenceResult>;
  analyzeUrl(url: string, hints?: AnalysisHints): Promise<ThreatIntelligenceResult>;
  /**
   * Análisis privado del archivo. En el MVP siempre se simula: el conector
   * real requiere licencia Premium y acuerdo autorizado con VirusTotal/Google
   * (no se inventan endpoints).
   */
  analyzeFilePrivateScanning(
    filePath: string,
    metadata: FileMetadataForScanning,
    hints?: AnalysisHints
  ): Promise<ThreatIntelligenceResult>;
}

export const PRIVATE_SCANNING_MVP_NOTE =
  "Private Scanning simulado para MVP académico. Conector preparado para integración autorizada.";
