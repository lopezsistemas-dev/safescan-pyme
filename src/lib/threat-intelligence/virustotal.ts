import type {
  AnalysisHints,
  FileMetadataForScanning,
  ThreatIntelligenceProvider,
  ThreatIntelligenceResult,
  TIVerdict,
} from "./types";
import { PRIVATE_SCANNING_MVP_NOTE } from "./types";
import { MockThreatIntelligenceProvider } from "./mock";

/**
 * Conector VirusTotal (API pública v3, endpoints documentados).
 *
 * - analyzeHash: GET /api/v3/files/{sha256}
 * - analyzeUrl:  GET /api/v3/urls/{id} (id = base64url de la URL)
 *
 * IMPORTANTE — Private Scanning: NO se implementa contra endpoints reales.
 * Es una capacidad Premium que requiere licencia y acuerdo autorizado con
 * VirusTotal/Google. Este conector delega en la simulación y lo indica
 * explícitamente (decisión documentada del MVP: no inventar endpoints).
 */

const VT_BASE = "https://www.virustotal.com/api/v3";

interface VtStats {
  malicious?: number;
  suspicious?: number;
  harmless?: number;
  undetected?: number;
  timeout?: number;
}

function verdictFromStats(stats: VtStats): { verdict: TIVerdict; detections: string } {
  const malicious = stats.malicious ?? 0;
  const suspicious = stats.suspicious ?? 0;
  const total =
    malicious + suspicious + (stats.harmless ?? 0) + (stats.undetected ?? 0) + (stats.timeout ?? 0);
  const verdict: TIVerdict =
    malicious >= 3 ? "malicious" : malicious + suspicious >= 1 ? "suspicious" : "clean";
  return { verdict, detections: `${malicious + suspicious}/${total || 70}` };
}

export class VirusTotalProvider implements ThreatIntelligenceProvider {
  readonly name = "VirusTotalProvider";
  private readonly mockFallback = new MockThreatIntelligenceProvider();

  constructor(
    private readonly apiKey: string,
    private readonly privateScanningEnabled: boolean
  ) {}

  private async vtGet(path: string): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${VT_BASE}${path}`, {
      headers: { "x-apikey": this.apiKey, accept: "application/json" },
      // Los análisis no deben quedar cacheados entre peticiones
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`VirusTotal respondió ${res.status} para ${path}`);
    return (await res.json()) as Record<string, unknown>;
  }

  private buildFromVtObject(
    obj: Record<string, unknown> | null,
    subject: string,
    notFoundExplanation: string
  ): ThreatIntelligenceResult {
    if (!obj) {
      return {
        verdict: "unknown",
        detections: "0/0",
        reputation: 0,
        matchedThreats: [],
        explanation: notFoundExplanation,
        providerUsed: "VirusTotal API v3",
        privateScanningUsed: false,
        rawTechnicalSummary: "vt=not_found",
      };
    }

    const data = obj.data as Record<string, unknown> | undefined;
    const attrs = (data?.attributes ?? {}) as Record<string, unknown>;
    const stats = (attrs.last_analysis_stats ?? {}) as VtStats;
    const { verdict, detections } = verdictFromStats(stats);
    const reputation = typeof attrs.reputation === "number" ? attrs.reputation : 0;

    const names = new Set<string>();
    const results = (attrs.last_analysis_results ?? {}) as Record<
      string,
      { category?: string; result?: string | null }
    >;
    for (const engine of Object.values(results)) {
      if (engine?.result && (engine.category === "malicious" || engine.category === "suspicious")) {
        names.add(engine.result);
        if (names.size >= 5) break;
      }
    }

    const explanationByVerdict: Record<TIVerdict, string> = {
      malicious: `VirusTotal confirma detecciones de amenaza en ${subject} (${detections} motores).`,
      suspicious: `VirusTotal marca ${subject} como sospechoso (${detections} motores).`,
      clean: `VirusTotal no registra detecciones para ${subject}.`,
      unknown: notFoundExplanation,
    };

    return {
      verdict,
      detections,
      reputation,
      matchedThreats: Array.from(names),
      explanation: explanationByVerdict[verdict],
      providerUsed: "VirusTotal API v3",
      privateScanningUsed: false,
      rawTechnicalSummary: `vt_stats=${JSON.stringify(stats)}; reputation=${reputation}`,
    };
  }

  async analyzeHash(hash: string): Promise<ThreatIntelligenceResult> {
    const obj = await this.vtGet(`/files/${encodeURIComponent(hash)}`);
    return this.buildFromVtObject(
      obj,
      `el archivo ${hash.slice(0, 12)}…`,
      "El hash no consta en VirusTotal: archivo no visto antes en el corpus público. Se recomienda precaución con archivos desconocidos."
    );
  }

  async analyzeUrl(url: string): Promise<ThreatIntelligenceResult> {
    // Identificador documentado de la API v3: base64url de la URL sin padding
    const id = Buffer.from(url).toString("base64url").replace(/=+$/, "");
    const obj = await this.vtGet(`/urls/${id}`);
    return this.buildFromVtObject(
      obj,
      "la URL",
      "La URL no consta en VirusTotal. Un enlace sin historial también puede ser una campaña muy reciente: se recomienda precaución."
    );
  }

  async analyzeFilePrivateScanning(
    filePath: string,
    metadata: FileMetadataForScanning,
    hints?: AnalysisHints
  ): Promise<ThreatIntelligenceResult> {
    // Sin acuerdo autorizado no hay endpoints reales que llamar: se simula
    // y se deja constancia. Con el flag activo, el resultado explica qué
    // requiere la integración real en lugar de fingirla.
    const simulated = await this.mockFallback.analyzeFilePrivateScanning(filePath, metadata, hints);
    if (!this.privateScanningEnabled) {
      return simulated;
    }
    return {
      ...simulated,
      explanation:
        `${PRIVATE_SCANNING_MVP_NOTE} La integración real de Private Scanning requiere licencia Premium de VirusTotal/Google y acuerdo autorizado; ` +
        "este MVP no llama a endpoints privados sin esa autorización. Resultado generado por la simulación local.",
    };
  }
}
