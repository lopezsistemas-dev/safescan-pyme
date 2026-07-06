import { describe, expect, it } from "vitest";
import { dataEgressFor } from "./egress";

describe("dataEgressFor — recibo de privacidad por análisis", () => {
  it("HASH_LOOKUP: solo sale la huella SHA-256; el contenido nunca sale", () => {
    const e = dataEgressFor({ inputType: "FILE", flow: "HASH_LOOKUP", mockMode: false });
    expect(e.left.map((i) => i.label)).toEqual(["Huella digital SHA-256"]);
    expect(e.neverLeft.some((i) => i.label === "Contenido del archivo")).toBe(true);
    expect(e.simulated).toBe(false);
  });

  it("URL_LOOKUP: sale la URL/dominio, ningún documento", () => {
    const e = dataEgressFor({ inputType: "URL", flow: "URL_LOOKUP", mockMode: false });
    expect(e.left.map((i) => i.label)).toEqual(["URL y dominio"]);
  });

  it("LOCAL_ONLY / QUARANTINE / HUMAN_REVIEW: no sale absolutamente nada", () => {
    for (const flow of ["LOCAL_ONLY", "QUARANTINE", "HUMAN_REVIEW"] as const) {
      const e = dataEgressFor({ inputType: "FILE", flow, mockMode: false });
      expect(e.left).toHaveLength(0);
      expect(e.summary).toMatch(/completamente local/i);
    }
  });

  it("PRIVATE_SCANNING: se marca como simulado y el documento no sale", () => {
    const e = dataEgressFor({ inputType: "FILE", flow: "PRIVATE_SCANNING", mockMode: false });
    expect(e.simulated).toBe(true);
    expect(e.neverLeft.some((i) => i.label.includes("Private Scanning"))).toBe(true);
  });

  it("mockMode marca el envío como simulado en un lookup real", () => {
    const e = dataEgressFor({ inputType: "FILE", flow: "HASH_LOOKUP", mockMode: true });
    expect(e.simulated).toBe(true);
    expect(e.summary).toMatch(/simulado/i);
  });

  it("EMAIL_TEXT: el texto del correo en claro nunca sale", () => {
    const e = dataEgressFor({ inputType: "EMAIL_TEXT", flow: "URL_LOOKUP", mockMode: true });
    expect(e.neverLeft.some((i) => i.label === "Texto del correo en claro")).toBe(true);
  });
});
