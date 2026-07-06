import { describe, expect, it } from "vitest";
import { guardAnalysisUrl } from "./url-guard";

describe("guardAnalysisUrl", () => {
  it("acepta URLs http/https bien formadas y las normaliza", () => {
    expect(guardAnalysisUrl("https://banco-seguro.example.com/login")).toEqual({
      ok: true,
      url: "https://banco-seguro.example.com/login",
    });
  });

  it("acepta URLs sin protocolo prependiendo http://", () => {
    const r = guardAnalysisUrl("pagos-verificacion-urgente.top");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toBe("http://pagos-verificacion-urgente.top/");
  });

  it("acepta IP directa (patrón real de phishing)", () => {
    const r = guardAnalysisUrl("http://185.100.87.202/cobro");
    expect(r.ok).toBe(true);
  });

  it("rechaza esquemas que no sean http/https", () => {
    for (const bad of ["file:///etc/passwd", "javascript:alert(1)", "data:text/html,<h1>x", "mailto:a@b.com"]) {
      const r = guardAnalysisUrl(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/http o https/i);
    }
  });

  it("rechaza hosts de una sola etiqueta (no son dominios)", () => {
    for (const bad of ["a", "localhost", "http://intranet"]) {
      expect(guardAnalysisUrl(bad).ok).toBe(false);
    }
  });

  it("rechaza credenciales embebidas en la URL", () => {
    const r = guardAnalysisUrl("http://usuario:secreta@ejemplo.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/credenciales/i);
  });
});
