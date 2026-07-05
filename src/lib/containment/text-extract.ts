import { PDFParse } from "pdf-parse";
import type { FileKind } from "./filetype";

/**
 * Extracción segura de texto para el análisis de indicadores.
 *
 * Solo se extrae texto de tipos que pueden leerse sin ejecutar nada:
 * texto plano, HTML, CSV, EML y PDF (con pdf-parse). Para Office,
 * comprimidos y ejecutables NO se extrae contenido en el MVP: el análisis
 * se basa en metadatos, tipo real, hash y señales estructurales
 * (limitación documentada en el README).
 */

const MAX_TEXT_CHARS = 300_000;

export interface PdfMeta {
  title?: string;
  author?: string;
  producer?: string;
  pages?: number;
}

export interface TextExtractionResult {
  text: string;
  note: string;
  pdfMeta?: PdfMeta;
}

export async function extractSafeText(
  buffer: Buffer,
  kind: FileKind,
  ext: string
): Promise<TextExtractionResult> {
  if (kind === "text" || kind === "html" || ["txt", "csv", "eml", "log", "md", "html", "htm"].includes(ext)) {
    return {
      text: buffer.toString("utf8").slice(0, MAX_TEXT_CHARS),
      note: "Texto extraído directamente (tipo de texto plano).",
    };
  }

  if (kind === "pdf") {
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      const text = (result.text ?? "").slice(0, MAX_TEXT_CHARS);

      let pdfMeta: PdfMeta | undefined;
      try {
        const info = await parser.getInfo();
        const raw = (info as { info?: Record<string, unknown> })?.info ?? {};
        pdfMeta = {
          title: typeof raw.Title === "string" ? raw.Title : undefined,
          author: typeof raw.Author === "string" ? raw.Author : undefined,
          producer: typeof raw.Producer === "string" ? raw.Producer : undefined,
          pages: (info as { total?: number })?.total,
        };
      } catch {
        // metadatos no disponibles: no es bloqueante
      }

      return {
        text,
        note:
          text.length > 0
            ? "Texto extraído del PDF con pdf-parse (análisis local)."
            : "El PDF no contiene texto extraíble (posible documento escaneado).",
        pdfMeta,
      };
    } catch {
      return {
        text: "",
        note: "No se pudo extraer texto del PDF; el análisis se basa en metadatos, hash y señales estructurales.",
      };
    } finally {
      try {
        await parser?.destroy?.();
      } catch {
        // liberar el parser nunca debe romper el flujo
      }
    }
  }

  return {
    text: "",
    note:
      "La extracción de texto para este tipo de archivo no está disponible en el MVP; el análisis se basa en metadatos, tipo real, hash e indicadores estructurales.",
  };
}
