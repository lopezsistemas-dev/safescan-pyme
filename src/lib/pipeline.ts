import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { PIPELINE_STAGES, VERDICT_LABELS, type InputType, type RecommendedFlow, type Verdict } from "@/lib/constants";
import { parsePolicy } from "@/lib/tenant";
import {
  containEmailText,
  containFile,
  containUrl,
  emptyContainment,
  maskPiiInText,
  readQuarantinedFile,
  type ContainmentResult,
} from "@/lib/containment";
import { evaluatePolicy, type PolicyResult } from "@/lib/policy/engine";
import {
  getThreatIntelligenceProvider,
  type ThreatIntelligenceResult,
} from "@/lib/threat-intelligence";
import { getAgentProvider, type ReportInput } from "@/lib/ai-agent";

/**
 * Pipeline de análisis de SafeScan.
 *
 * Ejecuta las etapas sobre un Analysis ya registrado, actualizando el
 * progreso en BD para que la UI muestre el timeline en tiempo real:
 *   contención → indicadores → política/privacidad → threat intel → informes
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setStage(analysisId: string, pct: number, label: string): Promise<void> {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: "ANALIZANDO", progressPct: pct, progressStage: label },
  });
  // En modo mock se añade una pausa breve para que el timeline sea legible
  if (env.threatIntelIsMock) await sleep(650);
}

/** Decide el veredicto final combinando política local e inteligencia externa. */
export function decideVerdict(
  policy: PolicyResult,
  ti: ThreatIntelligenceResult,
  flow: RecommendedFlow
): Verdict {
  if (ti.verdict === "malicious") return "BLOQUEAR";
  if (flow === "QUARANTINE") return policy.threatScore >= 85 ? "BLOQUEAR" : "CUARENTENA";
  if (flow === "HUMAN_REVIEW") return "ESCALAR";
  if (flow === "PRIVATE_SCANNING") {
    if (ti.verdict === "suspicious" || policy.sensitivityScore >= 80) return "ESCALAR";
    return "ABRIR_CON_PRECAUCION";
  }
  if (ti.verdict === "suspicious") {
    return policy.threatScore >= 60 ? "ESCALAR" : "ABRIR_CON_PRECAUCION";
  }
  if (ti.verdict === "unknown") {
    return policy.threatScore >= 40 ? "CUARENTENA" : "ABRIR_CON_PRECAUCION";
  }
  if (flow === "LOCAL_ONLY") {
    return policy.sensitivityScore >= 80 ? "ESCALAR" : "ABRIR_CON_PRECAUCION";
  }
  if (policy.threatScore >= 40 || policy.sensitivityScore >= 60) return "ABRIR_CON_PRECAUCION";
  return "ABRIR";
}

export async function runAnalysisPipeline(analysisId: string): Promise<void> {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: { tenant: true, user: true },
  });
  if (!analysis) throw new Error(`Análisis ${analysisId} no encontrado`);
  if (analysis.status === "COMPLETADO") return;

  const tenantPolicy = parsePolicy(analysis.tenant.policy);

  try {
    // ── Etapa 1: contención (hash y tipo real ya calculados en la subida) ──
    await setStage(analysisId, PIPELINE_STAGES[1].pct, PIPELINE_STAGES[1].label);

    let containment: ContainmentResult = emptyContainment();
    const inputType = analysis.inputType as InputType;

    if (inputType === "FILE" && analysis.filePath) {
      const buffer = await readQuarantinedFile(analysis.filePath);
      if (buffer) {
        containment = await containFile(
          buffer,
          analysis.originalName ?? "archivo",
          tenantPolicy.palabrasSensiblesExtra
        );
      }
    } else if (inputType === "URL" && analysis.inputValue) {
      containment = containUrl(analysis.inputValue, tenantPolicy.palabrasSensiblesExtra);
    } else if (inputType === "EMAIL_TEXT" && analysis.inputValue) {
      containment = containEmailText(analysis.inputValue, tenantPolicy.palabrasSensiblesExtra);
    }

    if (containment.fileType) {
      await prisma.analysis.update({
        where: { id: analysisId },
        data: { realType: containment.fileType.realTypeLabel },
      });
    }

    // ── Etapa 2: indicadores ────────────────────────────────────────────────
    await setStage(analysisId, PIPELINE_STAGES[2].pct, PIPELINE_STAGES[2].label);

    // Señales estructurales del archivo también quedan como indicadores
    const structuralIndicators: { type: string; value: string; risk: string }[] = [];
    if (containment.fileType?.doubleExtension) {
      structuralIndicators.push({
        type: "KEYWORD",
        value: `Doble extensión: ${analysis.originalName}`,
        risk: "ALTO",
      });
    }
    if (containment.fileType?.isExecutable) {
      structuralIndicators.push({ type: "KEYWORD", value: "Archivo ejecutable", risk: "ALTO" });
    }
    if (containment.fileType?.hasMacroExtension) {
      structuralIndicators.push({
        type: "KEYWORD",
        value: "Macros habilitadas (formato Office con macros)",
        risk: "ALTO",
      });
    }
    if (containment.fileType?.mismatch) {
      structuralIndicators.push({
        type: "KEYWORD",
        value: `El contenido real (${containment.fileType.realTypeLabel}) no coincide con la extensión .${containment.fileType.ext}`,
        risk: "ALTO",
      });
    }
    if (containment.archive) {
      if (containment.archive.doubleExtensionEntry) {
        structuralIndicators.push({
          type: "KEYWORD",
          value: `Dentro del ZIP: ${containment.archive.doubleExtensionEntry} (ejecutable camuflado)`,
          risk: "ALTO",
        });
      } else if (containment.archive.containsExecutable) {
        structuralIndicators.push({
          type: "KEYWORD",
          value: "El ZIP contiene al menos un archivo ejecutable",
          risk: "ALTO",
        });
      }
      if (containment.archive.entryNames.length > 0) {
        structuralIndicators.push({
          type: "KEYWORD",
          value: `Contenido del ZIP (${containment.archive.entryNames.length}): ${containment.archive.entryNames.slice(0, 5).join(", ")}${containment.archive.entryNames.length > 5 ? "…" : ""}`,
          risk: "BAJO",
        });
      }
    }
    if (analysis.sha256) {
      structuralIndicators.push({
        type: "HASH",
        value: `${analysis.sha256.slice(0, 16)}… (SHA-256)`,
        risk: "BAJO",
      });
    }

    const allIndicators = [
      ...structuralIndicators,
      ...containment.extraction.indicators.map((i) => ({ ...i })),
    ];

    await prisma.indicator.deleteMany({ where: { analysisId } });
    if (allIndicators.length > 0) {
      await prisma.indicator.createMany({
        data: allIndicators.map((i) => ({
          analysisId,
          type: i.type,
          value: i.value,
          risk: i.risk,
        })),
      });
    }

    // ── Etapa 3: Policy & Privacy Engine ───────────────────────────────────
    await setStage(analysisId, PIPELINE_STAGES[3].pct, PIPELINE_STAGES[3].label);

    const policyResult = evaluatePolicy({
      inputType,
      originalName: analysis.originalName,
      fileSize: analysis.fileSize,
      containment,
      policy: tenantPolicy,
      privateScanningEnabled: env.VIRUSTOTAL_PRIVATE_SCANNING_ENABLED,
    });

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        threatScore: policyResult.threatScore,
        sensitivityScore: policyResult.sensitivityScore,
        recommendedFlow: policyResult.recommendedFlow,
        policyJson: JSON.stringify(policyResult),
        // El flag `quarantined` se fija en la etapa final, ya con el veredicto
      },
    });

    // ── Etapa 4: inteligencia de amenazas según el flujo ───────────────────
    await setStage(analysisId, PIPELINE_STAGES[4].pct, PIPELINE_STAGES[4].label);

    const provider = getThreatIntelligenceProvider();
    const hints = {
      threatScore: policyResult.threatScore,
      threatSignals: policyResult.threatSignals,
      originalName: analysis.originalName,
    };

    let ti: ThreatIntelligenceResult;
    const flow = policyResult.recommendedFlow;
    try {
      if (flow === "URL_LOOKUP") {
        const url =
          inputType === "URL"
            ? (analysis.inputValue ?? "")
            : (containment.extraction.indicators.find((i) => i.type === "URL")?.value ?? "");
        ti = await provider.analyzeUrl(url, hints);
      } else if (flow === "PRIVATE_SCANNING" && analysis.filePath) {
        ti = await provider.analyzeFilePrivateScanning(
          analysis.filePath,
          {
            originalName: analysis.originalName ?? "archivo",
            sha256: analysis.sha256 ?? "",
            size: analysis.fileSize ?? 0,
            realTypeLabel: containment.fileType?.realTypeLabel ?? "desconocido",
          },
          hints
        );
      } else if (flow === "LOCAL_ONLY" || flow === "HUMAN_REVIEW") {
        // Por privacidad no se consulta ningún servicio externo
        ti = {
          verdict: policyResult.threatScore >= 70 ? "suspicious" : "clean",
          detections: "0/0",
          reputation: 0,
          matchedThreats: [],
          explanation:
            "Por la sensibilidad del contenido no se consultó ningún servicio externo: análisis exclusivamente local basado en heurísticas del Containment Engine.",
          providerUsed: "Análisis local (sin envío externo)",
          privateScanningUsed: false,
          rawTechnicalSummary: "local_only=true",
        };
      } else {
        // HASH_LOOKUP y QUARANTINE: consultar reputación del hash es seguro
        ti = await provider.analyzeHash(analysis.sha256 ?? "", hints);
      }
    } catch (err) {
      console.error("[pipeline] proveedor TI falló, degradando a mock:", err);
      const { MockThreatIntelligenceProvider } = await import("@/lib/threat-intelligence/mock");
      ti = await new MockThreatIntelligenceProvider().analyzeHash(analysis.sha256 ?? analysisId, hints);
      ti = { ...ti, explanation: `${ti.explanation} (El proveedor real no respondió; resultado de la simulación local.)` };
    }

    // ── Etapa 5: veredicto e informes ──────────────────────────────────────
    await setStage(analysisId, PIPELINE_STAGES[5].pct, PIPELINE_STAGES[5].label);

    const verdict = decideVerdict(policyResult, ti, flow);

    const reportInput: ReportInput = {
      inputType,
      originalName: analysis.originalName,
      // El texto pegado por el usuario (correo/URL) se enmascara antes de
      // llegar a la capa de IA: los datos personales nunca viajan en claro
      inputValue: inputType === "FILE" ? null : maskPiiInText(analysis.inputValue ?? ""),
      sha256: analysis.sha256,
      realTypeLabel: containment.fileType?.realTypeLabel ?? analysis.realType,
      fileSize: analysis.fileSize,
      threatScore: policyResult.threatScore,
      sensitivityScore: policyResult.sensitivityScore,
      recommendedFlow: flow,
      verdict,
      reason: policyResult.reason,
      privacyExplanation: policyResult.privacyExplanation,
      securityExplanation: policyResult.securityExplanation,
      threatSignals: policyResult.threatSignals,
      sensitivitySignals: policyResult.sensitivitySignals,
      indicators: allIndicators,
      ti,
      tenantName: analysis.tenant.name,
      sector: analysis.tenant.sector,
      mockMode: env.threatIntelIsMock,
    };

    const agent = getAgentProvider();
    const reports = await agent.generateReports(reportInput);

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETADO",
        progressPct: 100,
        progressStage: PIPELINE_STAGES[6].label,
        finalVerdict: verdict,
        providerUsed: ti.providerUsed,
        privateScanningUsed: ti.privateScanningUsed,
        mockMode: env.threatIntelIsMock,
        employeeReport: reports.employeeReport,
        adminReport: reports.adminReport,
        tiJson: JSON.stringify(ti),
        // El estado de cuarentena refleja el veredicto real (no solo el flujo):
        // un archivo bloqueado/escalado/retenido queda marcado como contenido.
        quarantined:
          inputType === "FILE" &&
          (["BLOQUEAR", "CUARENTENA", "ESCALAR"].includes(verdict) ||
            ["QUARANTINE", "HUMAN_REVIEW", "PRIVATE_SCANNING"].includes(flow)),
        // Privacidad por diseño: el texto libre (correo/URL) se guarda ya
        // enmascarado una vez completado el análisis. El crudo solo existe en
        // memoria durante el pipeline; nunca reposa en la base de datos.
        ...(inputType !== "FILE" && analysis.inputValue
          ? { inputValue: maskPiiInText(analysis.inputValue) }
          : {}),
      },
    });

    await audit({
      tenantId: analysis.tenantId,
      userId: analysis.userId,
      analysisId,
      action: "ANALISIS_COMPLETADO",
      details: `Veredicto ${VERDICT_LABELS[verdict]} (amenaza ${policyResult.threatScore}, sensibilidad ${policyResult.sensitivityScore}). Flujo ${flow}. Proveedor: ${ti.providerUsed}.`,
    });
  } catch (err) {
    console.error("[pipeline] error en el análisis:", err);
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "ERROR",
        progressStage: "Error durante el análisis",
      },
    });
    await audit({
      tenantId: analysis.tenantId,
      userId: analysis.userId,
      analysisId,
      action: "ANALISIS_ERROR",
      details: `El análisis falló: ${err instanceof Error ? err.message : "error desconocido"}`,
    });
    throw err;
  }
}
