import { EXECUTABLE_EXTENSIONS, getDoubleExtension, getExtension } from "./filetype";

/**
 * Inspección segura de archivos ZIP: se leen ÚNICAMENTE los nombres de las
 * entradas desde las cabeceras locales (PK\x03\x04). No se descomprime ni
 * se ejecuta nada — suficiente para detectar el patrón más común de ataque
 * a pymes: un ejecutable camuflado dentro de un comprimido "de facturas".
 */

const LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const MAX_ENTRIES = 50;

export interface ArchiveInspection {
  entryNames: string[];
  containsExecutable: boolean;
  /** Primera entrada con doble extensión (p. ej. factura.pdf.exe). */
  doubleExtensionEntry: string | null;
  truncated: boolean;
}

export function inspectZipEntries(buffer: Buffer): ArchiveInspection {
  const entryNames: string[] = [];
  let offset = 0;
  let truncated = false;

  while (entryNames.length < MAX_ENTRIES) {
    const idx = buffer.indexOf(LOCAL_HEADER, offset);
    if (idx === -1 || idx + 30 > buffer.length) break;

    const nameLength = buffer.readUInt16LE(idx + 26);
    const extraLength = buffer.readUInt16LE(idx + 28);
    const nameStart = idx + 30;

    if (nameLength === 0 || nameLength > 512 || nameStart + nameLength > buffer.length) {
      offset = idx + 4;
      continue;
    }

    entryNames.push(buffer.toString("utf8", nameStart, nameStart + nameLength));
    offset = nameStart + nameLength + extraLength;
  }

  if (entryNames.length === MAX_ENTRIES) truncated = true;

  const files = entryNames.filter((n) => !n.endsWith("/"));
  const containsExecutable = files.some((n) => EXECUTABLE_EXTENSIONS.has(getExtension(n)));
  const doubleExtensionEntry = files.find((n) => getDoubleExtension(n) !== null) ?? null;

  return { entryNames, containsExecutable, doubleExtensionEntry, truncated };
}
