import type {
  AnalysisHints,
  FileMetadataForScanning,
  ThreatIntelligenceProvider,
  ThreatIntelligenceResult,
  TIVerdict,
} from "./types";
import { PRIVATE_SCANNING_MVP_NOTE } from "./types";

/**
 * Proveedor mock de inteligencia de amenazas.
 *
 * Genera veredictos realistas y DETERMINISTAS a partir de las señales
 * locales (threatScore del Policy Engine) más una pequeña variación
 * derivada del hash/URL, de modo que la demo sea coherente y repetible.
 */

const TOTAL_ENGINES = 70;

/** Variación determinista 0..n-1 derivada de un string. */
function deterministicVariation(seed: string, n: number): number {
  let acc = 0;
  for (let i = 0; i < seed.length; i++) acc = (acc * 31 + seed.charCodeAt(i)) % 997;
  return acc % n;
}

function verdictFromScore(score: number): TIVerdict {
  if (score >= 70) return "malicious";
  if (score >= 40) return "suspicious";
  return "clean";
}

function threatNamesFromSignals(signals: string[]): string[] {
  const names: string[] = [];
  const has = (frag: string) => signals.some((s) => s.toLowerCase().includes(frag));
  if (has("doble extensión")) names.push("Mal/DoubleExt-A (simulado)");
  if (has("ejecutable")) names.push("Trojan.GenericKD (simulado)");
  if (has("macros")) names.push("Doc.Macro.Generic (simulado)");
  if (has("acortado") || has("phishing") || has("tld")) names.push("Phishing.PaymentScam (simulado)");
  if (has("comprimido")) names.push("Archive.Suspicious.Payload (simulado)");
  if (has("punycode")) names.push("Phishing.Homoglyph (simulado)");
  return names;
}

function buildResult(
  seed: string,
  hints: AnalysisHints | undefined,
  providerLabel: string,
  privateScanning: boolean,
  subject: string
): ThreatIntelligenceResult {
  const score = hints?.threatScore ?? 0;
  const verdict = verdictFromScore(score);
  const variation = deterministicVariation(seed, 7);

  let detections: number;
  let reputation: number;
  let explanation: string;

  switch (verdict) {
    case "malicious":
      detections = Math.min(TOTAL_ENGINES, Math.round(score * 0.45) + variation);
      reputation = -60 - variation * 3;
      explanation = `La inteligencia de amenazas (simulada) coincide con las señales locales: ${subject} presenta un patrón conocido de amenaza.`;
      break;
    case "suspicious":
      detections = 5 + variation;
      reputation = -25 - variation * 2;
      explanation = `Varios motores (simulados) marcan ${subject} como sospechoso. No hay confirmación unánime: se recomienda precaución.`;
      break;
    default:
      detections = 0;
      reputation = 10 + variation * 5;
      explanation = `Ningún motor (simulado) detecta amenazas en ${subject}.`;
  }

  const matchedThreats = verdict === "clean" ? [] : threatNamesFromSignals(hints?.threatSignals ?? []);

  return {
    verdict,
    detections: `${detections}/${TOTAL_ENGINES}`,
    reputation,
    matchedThreats,
    explanation,
    providerUsed: providerLabel,
    privateScanningUsed: privateScanning,
    rawTechnicalSummary: [
      `verdict=${verdict}`,
      `detections=${detections}/${TOTAL_ENGINES}`,
      `reputation=${reputation}`,
      matchedThreats.length ? `threats=${matchedThreats.join("|")}` : "threats=none",
      `mode=mock-deterministic`,
    ].join("; "),
  };
}

export class MockThreatIntelligenceProvider implements ThreatIntelligenceProvider {
  readonly name = "MockThreatIntelligenceProvider";

  async analyzeHash(hash: string, hints?: AnalysisHints): Promise<ThreatIntelligenceResult> {
    return buildResult(
      hash,
      hints,
      "MockThreatIntelligence (simulación VirusTotal)",
      false,
      `el archivo con hash ${hash.slice(0, 8)}…`
    );
  }

  async analyzeUrl(url: string, hints?: AnalysisHints): Promise<ThreatIntelligenceResult> {
    return buildResult(url, hints, "MockThreatIntelligence (simulación VirusTotal)", false, "la URL");
  }

  async analyzeFilePrivateScanning(
    _filePath: string,
    metadata: FileMetadataForScanning,
    hints?: AnalysisHints
  ): Promise<ThreatIntelligenceResult> {
    const result = buildResult(
      metadata.sha256,
      hints,
      "MockThreatIntelligence (Private Scanning simulado)",
      true,
      `el documento ${metadata.originalName}`
    );
    return {
      ...result,
      explanation: `${result.explanation} ${PRIVATE_SCANNING_MVP_NOTE} El documento se trató como privado: sin subida a corpus público, visibilidad limitada a la empresa y retención corta.`,
      rawTechnicalSummary: `${result.rawTechnicalSummary}; private_scanning=simulated`,
    };
  }
}
