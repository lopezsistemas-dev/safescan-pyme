/**
 * Detección de tipo real de archivo por firma binaria (magic bytes) y
 * análisis de extensiones. Nunca se ejecuta ni se abre el archivo:
 * solo se inspeccionan sus primeros bytes.
 */

export type FileKind =
  | "pdf"
  | "zip"
  | "office"
  | "office-legacy"
  | "exe"
  | "rar"
  | "7z"
  | "image"
  | "text"
  | "html"
  | "unknown";

export const EXECUTABLE_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl", "hta",
  "js", "jse", "vbs", "vbe", "wsf", "wsh", "ps1", "jar", "app", "dmg",
]);

export const MACRO_EXTENSIONS = new Set(["xlsm", "docm", "pptm", "xlam", "dotm"]);

export const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "gz", "tar", "iso", "img", "cab"]);

export const OFFICE_EXTENSIONS = new Set([
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf",
  ...MACRO_EXTENSIONS,
]);

/** Extensiones "inofensivas" usadas como disfraz en dobles extensiones. */
const DISGUISE_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv",
  "jpg", "jpeg", "png", "gif", "html", "htm", "zip", "mp3", "mp4",
]);

export function getExtension(name: string): string {
  const m = /\.([a-z0-9]{1,6})$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export interface DoubleExtension {
  disguisedAs: string;
  actual: string;
}

/**
 * Detecta el patrón clásico de ejecutable camuflado: nombre.pdf.exe,
 * factura.docx.js, foto.jpg.scr…
 */
export function getDoubleExtension(name: string): DoubleExtension | null {
  const m = /\.([a-z0-9]{2,5})\.([a-z0-9]{2,4})$/i.exec(name.trim());
  if (!m) return null;
  const disguisedAs = m[1].toLowerCase();
  const actual = m[2].toLowerCase();
  if (DISGUISE_EXTENSIONS.has(disguisedAs) && EXECUTABLE_EXTENSIONS.has(actual)) {
    return { disguisedAs, actual };
  }
  return null;
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

/** Identifica el tipo real por los primeros bytes del archivo. */
export function detectKindFromBytes(buf: Buffer): FileKind {
  if (buf.length === 0) return "unknown";
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(buf, [0x4d, 0x5a])) return "exe"; // MZ (PE Windows)
  if (startsWith(buf, [0x7f, 0x45, 0x4c, 0x46])) return "exe"; // ELF
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buf, [0x50, 0x4b, 0x05, 0x06]))
    return "zip"; // PK (zip / OOXML)
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0])) return "office-legacy"; // OLE2 (doc/xls antiguos)
  if (startsWith(buf, [0x52, 0x61, 0x72, 0x21])) return "rar"; // Rar!
  if (startsWith(buf, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "7z";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image"; // JPEG
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return "image"; // PNG
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return "image"; // GIF

  // Heurística de texto: los primeros bytes son mayoritariamente imprimibles
  const sample = buf.subarray(0, Math.min(buf.length, 2048));
  let printable = 0;
  for (const b of sample) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b < 0xf5)) printable++;
  }
  if (printable / sample.length > 0.92) {
    const head = sample.toString("utf8", 0, Math.min(sample.length, 512)).trimStart().toLowerCase();
    if (head.startsWith("<!doctype html") || head.startsWith("<html")) return "html";
    return "text";
  }
  return "unknown";
}

const KIND_LABELS: Record<FileKind, string> = {
  pdf: "Documento PDF",
  zip: "Archivo comprimido ZIP",
  office: "Documento de Office (OOXML)",
  "office-legacy": "Documento de Office antiguo (OLE2)",
  exe: "Programa ejecutable",
  rar: "Archivo comprimido RAR",
  "7z": "Archivo comprimido 7-Zip",
  image: "Imagen",
  text: "Archivo de texto",
  html: "Documento HTML",
  unknown: "Tipo no identificado",
};

/** Kind esperado según la extensión declarada (para detectar incoherencias). */
function expectedKindForExtension(ext: string): FileKind | null {
  if (ext === "pdf") return "pdf";
  if (["zip"].includes(ext)) return "zip";
  if (ext === "rar") return "rar";
  if (ext === "7z") return "7z";
  if (["docx", "xlsx", "pptx", ...MACRO_EXTENSIONS].includes(ext)) return "zip"; // OOXML = contenedor zip
  if (["doc", "xls", "ppt"].includes(ext)) return "office-legacy";
  if (["jpg", "jpeg", "png", "gif"].includes(ext)) return "image";
  if (["txt", "csv", "log", "md", "eml"].includes(ext)) return "text";
  if (["html", "htm"].includes(ext)) return "html";
  if (EXECUTABLE_EXTENSIONS.has(ext)) return "exe";
  return null;
}

export interface FileTypeAnalysis {
  ext: string;
  kind: FileKind;
  realTypeLabel: string;
  /** La extensión declarada no coincide con el tipo real detectado. */
  mismatch: boolean;
  doubleExtension: DoubleExtension | null;
  isExecutable: boolean;
  hasMacroExtension: boolean;
  isArchive: boolean;
}

export function analyzeFileType(buffer: Buffer, originalName: string): FileTypeAnalysis {
  const ext = getExtension(originalName);
  const rawKind = detectKindFromBytes(buffer);

  // Un OOXML es un zip: si la extensión es de Office moderno, es un documento Office
  const isOoxmlExt = ["docx", "xlsx", "pptx", ...MACRO_EXTENSIONS].includes(ext);
  const kind: FileKind = rawKind === "zip" && isOoxmlExt ? "office" : rawKind;

  const expected = expectedKindForExtension(ext);
  // La incoherencia grave es que el contenido real sea distinto de lo declarado
  // (especialmente un ejecutable disfrazado de documento)
  const mismatch =
    expected !== null &&
    rawKind !== "unknown" &&
    expected !== rawKind &&
    !(expected === "zip" && (rawKind === "zip" || kind === "office")) &&
    !(expected === "text" && rawKind === "html");

  const doubleExtension = getDoubleExtension(originalName);
  const isExecutable = kind === "exe" || EXECUTABLE_EXTENSIONS.has(ext);
  const hasMacroExtension = MACRO_EXTENSIONS.has(ext);
  const isArchive =
    (kind === "zip" && !isOoxmlExt) || kind === "rar" || kind === "7z" || ARCHIVE_EXTENSIONS.has(ext);

  return {
    ext,
    kind,
    realTypeLabel:
      hasMacroExtension && (kind === "office" || kind === "zip")
        ? "Documento de Office con macros habilitadas"
        : KIND_LABELS[kind],
    mismatch,
    doubleExtension,
    isExecutable,
    hasMacroExtension,
    isArchive,
  };
}
