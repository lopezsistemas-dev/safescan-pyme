import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "./engine";
import { containFile, containUrl, emptyContainment } from "@/lib/containment";
import { getDoubleExtension } from "@/lib/containment/filetype";
import { isValidDniNie, maskDni, maskIban, maskPiiInText } from "@/lib/containment/indicators";
import { decideVerdict } from "@/lib/pipeline";
import { DEFAULT_POLICY, type TenantPolicy } from "@/lib/tenant";
import type { ThreatIntelligenceResult } from "@/lib/threat-intelligence";

/**
 * Tests del Policy & Privacy Engine con los casos demo de la memoria:
 *   1. factura.pdf.exe        → ejecutable camuflado → QUARANTINE
 *   2. reservas_agosto.xlsm   → macros + datos de clientes → PRIVATE_SCANNING
 *   3. PDF con DNI e IBAN     → sensibilidad extrema → HUMAN_REVIEW
 *   4. URL acortada           → URL_LOOKUP con señal de riesgo
 *   5. Archivo limpio         → HASH_LOOKUP y veredicto ABRIR
 */

const policy: TenantPolicy = { ...DEFAULT_POLICY };

// Buffer con firma de ejecutable Windows (MZ). Solo cabecera: nunca se ejecuta.
const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

const cleanTi: ThreatIntelligenceResult = {
  verdict: "clean",
  detections: "0/70",
  reputation: 20,
  matchedThreats: [],
  explanation: "",
  providerUsed: "test",
  privateScanningUsed: false,
  rawTechnicalSummary: "",
};

describe("Policy & Privacy Engine", () => {
  it("caso 1: factura.pdf.exe (doble extensión) → QUARANTINE y riesgo alto", async () => {
    const containment = await containFile(exeBuffer, "factura.pdf.exe");

    expect(containment.fileType?.doubleExtension).toEqual({ disguisedAs: "pdf", actual: "exe" });
    expect(containment.fileType?.isExecutable).toBe(true);

    const result = evaluatePolicy({
      inputType: "FILE",
      originalName: "factura.pdf.exe",
      containment,
      policy,
      privateScanningEnabled: false,
    });

    expect(result.recommendedFlow).toBe("QUARANTINE");
    expect(result.threatScore).toBeGreaterThanOrEqual(85);
    expect(result.threatSignals.join(" ")).toContain("Doble extensión");

    const maliciousTi: ThreatIntelligenceResult = { ...cleanTi, verdict: "malicious" };
    expect(decideVerdict(result, maliciousTi, result.recommendedFlow)).toBe("BLOQUEAR");
  });

  it("caso 2: reservas_agosto.xlsm con datos de clientes → PRIVATE_SCANNING", async () => {
    // Fixture demo: contenido de texto con datos de reservas (los .xlsm reales
    // no exponen texto en el MVP, pero las macros ya fuerzan riesgo alto)
    const content = [
      "Reservas agosto - listado de clientes del hotel",
      "cliente: Ana Pérez, ana.perez@mail.com, 612345678, reserva 1203, booking",
      "cliente: Luis Gómez, luis.gomez@mail.com, 698765432, reserva 1204, check-in",
      "cliente: Eva Ruiz, eva.ruiz@mail.com, 655443322, reserva 1205",
    ].join("\n");

    const hotelPolicy: TenantPolicy = {
      ...policy,
      umbralSensibilidad: 55,
      privateScanningPreferido: true,
      palabrasSensiblesExtra: ["huésped", "check-in", "booking"],
    };

    const containment = await containFile(
      Buffer.from(content, "utf8"),
      "reservas_agosto.xlsm",
      hotelPolicy.palabrasSensiblesExtra
    );

    expect(containment.fileType?.hasMacroExtension).toBe(true);

    const result = evaluatePolicy({
      inputType: "FILE",
      originalName: "reservas_agosto.xlsm",
      containment,
      policy: hotelPolicy,
      privateScanningEnabled: false,
    });

    expect(result.threatScore).toBeGreaterThanOrEqual(60); // macros → riesgo alto siempre
    expect(result.sensitivityScore).toBeGreaterThanOrEqual(55); // datos de clientes
    expect(result.recommendedFlow).toBe("PRIVATE_SCANNING");

    const suspiciousTi: ThreatIntelligenceResult = { ...cleanTi, verdict: "suspicious" };
    expect(decideVerdict(result, suspiciousTi, result.recommendedFlow)).toBe("ESCALAR");
  });

  it("caso 3: documento con DNI e IBAN → sensibilidad extrema → HUMAN_REVIEW", async () => {
    const content = [
      "Documentación del paciente",
      "DNI: 12345678Z",
      "IBAN: ES91 2100 0418 4502 0005 1332",
      "Historia clínica y diagnóstico adjuntos.",
    ].join("\n");

    const containment = await containFile(Buffer.from(content, "utf8"), "documentacion_paciente.txt");

    // Los valores sensibles se guardan siempre enmascarados
    const dniIndicator = containment.extraction.indicators.find((i) => i.type === "DNI");
    const ibanIndicator = containment.extraction.indicators.find((i) => i.type === "IBAN");
    expect(dniIndicator?.value).not.toContain("12345678Z");
    expect(ibanIndicator?.value).not.toContain("21000418450200051332");

    const result = evaluatePolicy({
      inputType: "FILE",
      originalName: "documentacion_paciente.txt",
      containment,
      policy,
      privateScanningEnabled: false,
    });

    expect(result.sensitivityScore).toBeGreaterThanOrEqual(80);
    expect(result.recommendedFlow).toBe("HUMAN_REVIEW");
    expect(decideVerdict(result, cleanTi, result.recommendedFlow)).toBe("ESCALAR");
  });

  it("caso 4: URL acortada → URL_LOOKUP con señal de enlace acortado", () => {
    const containment = containUrl("https://bit.ly/3xYz12");

    const result = evaluatePolicy({
      inputType: "URL",
      containment,
      policy,
      privateScanningEnabled: false,
    });

    expect(result.recommendedFlow).toBe("URL_LOOKUP");
    expect(result.threatScore).toBeGreaterThanOrEqual(25);
    expect(result.threatSignals.join(" ")).toContain("acortado");
  });

  it("caso 5: archivo de texto limpio → HASH_LOOKUP y veredicto ABRIR", async () => {
    const containment = await containFile(
      Buffer.from("Acta de la reunión semanal del equipo.\nAsistentes y puntos tratados.", "utf8"),
      "acta_reunion.txt"
    );

    const result = evaluatePolicy({
      inputType: "FILE",
      originalName: "acta_reunion.txt",
      containment,
      policy,
      privateScanningEnabled: false,
    });

    expect(result.recommendedFlow).toBe("HASH_LOOKUP");
    expect(result.threatScore).toBeLessThan(40);
    expect(result.sensitivityScore).toBeLessThan(40);
    expect(decideVerdict(result, cleanTi, result.recommendedFlow)).toBe("ABRIR");
  });

  it("caso 1b: ZIP con ejecutable camuflado dentro → QUARANTINE", async () => {
    // ZIP mínimo sintético: cabecera local PK\x03\x04 con una entrada
    // llamada factura.pdf.exe (solo se leen nombres, nunca se descomprime)
    const entryName = "factura.pdf.exe";
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(entryName.length, 26);
    const zipBuffer = Buffer.concat([header, Buffer.from(entryName, "utf8")]);

    const containment = await containFile(zipBuffer, "factura_urgente.zip");

    expect(containment.archive?.containsExecutable).toBe(true);
    expect(containment.archive?.doubleExtensionEntry).toBe("factura.pdf.exe");

    const result = evaluatePolicy({
      inputType: "FILE",
      originalName: "factura_urgente.zip",
      containment,
      policy,
      privateScanningEnabled: false,
    });

    expect(result.recommendedFlow).toBe("QUARANTINE");
    expect(result.threatScore).toBeGreaterThanOrEqual(85);
  });

  it("una entrada vacía no rompe el motor", () => {
    const result = evaluatePolicy({
      inputType: "FILE",
      containment: emptyContainment(),
      policy,
      privateScanningEnabled: false,
    });
    expect(result.recommendedFlow).toBe("HASH_LOOKUP");
  });
});

describe("Utilidades de contención", () => {
  it("detecta dobles extensiones clásicas y respeta nombres normales", () => {
    expect(getDoubleExtension("factura.pdf.exe")).toEqual({ disguisedAs: "pdf", actual: "exe" });
    expect(getDoubleExtension("foto.jpg.scr")).toEqual({ disguisedAs: "jpg", actual: "scr" });
    expect(getDoubleExtension("informe.final.pdf")).toBeNull();
    expect(getDoubleExtension("documento.docx")).toBeNull();
  });

  it("valida la letra de control de DNI/NIE", () => {
    expect(isValidDniNie("12345678Z")).toBe(true);
    expect(isValidDniNie("12345678A")).toBe(false); // letra incorrecta
    expect(isValidDniNie("X1234567L")).toBe(true);
  });

  it("enmascara datos personales", () => {
    expect(maskDni("12345678Z")).toBe("12*****Z");
    expect(maskIban("ES9121000418450200051332")).toBe("ES91 **** **** 1332");
  });

  it("enmascara la PII de un texto libre antes de enviarlo a la IA", () => {
    const masked = maskPiiInText(
      "Cliente Ana (ana.perez@mail.com, 612345678), DNI 12345678Z, IBAN ES91 2100 0418 4502 0005 1332"
    );
    expect(masked).not.toContain("ana.perez@mail.com");
    expect(masked).not.toContain("612345678");
    expect(masked).not.toContain("12345678Z");
    expect(masked).not.toContain("0005 1332");
    expect(masked).toContain("@mail.com"); // el dominio se conserva como señal
  });
});
