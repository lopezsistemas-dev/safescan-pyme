import { describe, expect, it } from "vitest";
import { analyzeFileType, detectKindFromBytes, getDoubleExtension } from "./filetype";
import { inspectZipEntries } from "./archive";
import { isValidDniNie, isValidIban, maskPiiInText } from "./indicators";

/**
 * Tests del núcleo de contención y privacidad de SafeScan PYME.
 *
 * Cubren las dos garantías que sostienen la tesis del producto:
 *  1. "La privacidad durante el análisis también es ciberseguridad": ningún
 *     dato personal (DNI/NIE, IBAN, email, teléfono) sobrevive en claro al
 *     enmascarado que se aplica antes de persistir o de llegar a la IA.
 *  2. Contención sin ejecución: el tipo real se detecta por magic bytes y los
 *     ZIP se inspeccionan leyendo solo nombres de entrada (sin descomprimir),
 *     detectando ejecutables camuflados y dobles extensiones.
 */

// ── Utilidad: construir un ZIP sintético con solo cabeceras locales PK\x03\x04 ──
function zipEntry(name: string): Buffer {
  const nameBuf = Buffer.from(name, "utf8");
  const head = Buffer.alloc(30);
  head[0] = 0x50; // P
  head[1] = 0x4b; // K
  head[2] = 0x03;
  head[3] = 0x04;
  head.writeUInt16LE(nameBuf.length, 26); // nameLength
  head.writeUInt16LE(0, 28); // extraLength
  return Buffer.concat([head, nameBuf]);
}
const zipOf = (names: string[]) => Buffer.concat(names.map(zipEntry));

// ─────────────────────────────────────────────────────────────────────────
describe("Invariante de privacidad: maskPiiInText no deja PII en claro", () => {
  // Valores ficticios pero válidos según los validadores reales (mód-97 / letra de control)
  const DNI = "12345678Z";
  const IBAN = "ES9121000418450200051332";
  const EMAIL = "juan.perez@ejemplo.com";
  const PHONE = "+34 612 345 678";

  it("los valores de prueba son válidos (si no, el test no probaría nada)", () => {
    expect(isValidDniNie(DNI)).toBe(true);
    expect(isValidIban(IBAN)).toBe(true);
  });

  it("enmascara DNI, IBAN, email y teléfono conservando una forma reconocible", () => {
    expect(maskPiiInText(`DNI ${DNI}`)).toBe("DNI 12*****Z");
    expect(maskPiiInText(`IBAN ${IBAN}`)).toBe("IBAN ES91 **** **** 1332");
    expect(maskPiiInText(`mail ${EMAIL}`)).toBe("mail j*********@ejemplo.com");
    expect(maskPiiInText(`tel ${PHONE}`)).toContain("**");
  });

  it("ningún valor personal crudo sobrevive al enmascarado combinado", () => {
    const texto = `Adjunto la nómina. DNI ${DNI}, IBAN ${IBAN}, contacto ${EMAIL} o ${PHONE}.`;
    const out = maskPiiInText(texto);
    expect(out).not.toContain(DNI);
    expect(out).not.toContain(IBAN);
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain("612345678");
    expect(out).not.toContain("612 345 678");
  });

  it("no altera texto sin PII y no rompe con cadena vacía", () => {
    expect(maskPiiInText("")).toBe("");
    expect(maskPiiInText("Factura del proveedor habitual, todo correcto.")).toBe(
      "Factura del proveedor habitual, todo correcto."
    );
  });

  it("no enmascara un DNI con letra de control incorrecta (evita falsos positivos)", () => {
    // 12345678A tiene la letra equivocada: no es un DNI válido, no debe enmascararse
    expect(isValidDniNie("12345678A")).toBe(false);
    expect(maskPiiInText("ref 12345678A")).toBe("ref 12345678A");
  });

  it("no enmascara un IBAN con checksum mód-97 inválido", () => {
    const badIban = "ES0021000418450200051332";
    expect(isValidIban(badIban)).toBe(false);
    expect(maskPiiInText(`IBAN ${badIban}`)).toContain(badIban);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Detección de tipo real por magic bytes", () => {
  it("identifica firmas conocidas por sus primeros bytes", () => {
    expect(detectKindFromBytes(Buffer.from("%PDF-1.7"))).toBe("pdf");
    expect(detectKindFromBytes(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBe("exe"); // MZ (PE)
    expect(detectKindFromBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe("zip"); // PK
    expect(detectKindFromBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image"); // JPEG
    expect(detectKindFromBytes(Buffer.from("hola, esto es texto plano"))).toBe("text");
  });

  it("un archivo vacío es 'unknown' (no se asume nada)", () => {
    expect(detectKindFromBytes(Buffer.alloc(0))).toBe("unknown");
  });

  it("detecta un ejecutable (MZ) disfrazado de PDF: mismatch + isExecutable", () => {
    const mz = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(20)]);
    const a = analyzeFileType(mz, "factura_importante.pdf");
    expect(a.kind).toBe("exe");
    expect(a.mismatch).toBe(true);
    expect(a.isExecutable).toBe(true);
  });

  it("un .docx real (contenedor OOXML/zip) NO es mismatch y se clasifica como office", () => {
    const pk = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(20)]);
    const a = analyzeFileType(pk, "contrato.docx");
    expect(a.kind).toBe("office");
    expect(a.mismatch).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Doble extensión (ejecutable camuflado)", () => {
  it("detecta el patrón nombre.<doc>.<exe>", () => {
    expect(getDoubleExtension("factura.pdf.exe")).toEqual({ disguisedAs: "pdf", actual: "exe" });
    expect(getDoubleExtension("foto.jpg.scr")).toEqual({ disguisedAs: "jpg", actual: "scr" });
  });

  it("no marca dobles extensiones inocuas ni nombres normales", () => {
    expect(getDoubleExtension("informe.pdf")).toBeNull();
    expect(getDoubleExtension("backup.tar.gz")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Inspección de ZIP sin descomprimir", () => {
  it("una carpeta y un .txt no disparan alarma", () => {
    const r = inspectZipEntries(zipOf(["documentos/", "documentos/informe.txt"]));
    expect(r.containsExecutable).toBe(false);
    expect(r.doubleExtensionEntry).toBeNull();
    expect(r.truncated).toBe(false);
    expect(r.entryNames).toContain("documentos/informe.txt");
  });

  it("detecta un ejecutable con doble extensión dentro del comprimido", () => {
    const r = inspectZipEntries(zipOf(["lista.txt", "factura.pdf.exe"]));
    expect(r.containsExecutable).toBe(true);
    expect(r.doubleExtensionEntry).toBe("factura.pdf.exe");
  });

  it("acota la inspección: más de 50 entradas marca 'truncated' (anti-DoS)", () => {
    const many = Array.from({ length: 51 }, (_, i) => `documento_${i}.txt`);
    const r = inspectZipEntries(zipOf(many));
    expect(r.entryNames.length).toBe(50);
    expect(r.truncated).toBe(true);
  });
});
