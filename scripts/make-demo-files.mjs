/**
 * Genera los archivos de demostración de demo-files/.
 *
 * TODOS los archivos son inofensivos: textos y PDFs con datos FICTICIOS.
 * El "ejecutable" dentro del ZIP es un archivo de texto con nombre
 * malicioso (factura.pdf.exe): suficiente para demostrar la detección
 * sin crear ningún programa real.
 *
 * Uso: node scripts/make-demo-files.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUT = path.resolve(process.cwd(), "demo-files");
mkdirSync(OUT, { recursive: true });

// ── Mini escritor de ZIP (método STORE, sin compresión) ──────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (const byte of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // método STORE
    local.writeUInt32LE(0, 10); // fecha/hora DOS
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuf, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // hecho por
    cd.writeUInt16LE(20, 6); // versión necesaria
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt32LE(0, 12);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));

    offset += local.length + nameBuf.length + data.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, cdBuf, eocd]);
}

// ── Generador de PDFs sencillos ───────────────────────────────────────────

async function makePdf(title, lines) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]); // A4

  page.drawText(title, { x: 60, y: 770, size: 18, font: bold, color: rgb(0.1, 0.15, 0.3) });
  let y = 730;
  for (const line of lines) {
    page.drawText(line, { x: 60, y, size: 11, font, color: rgb(0.15, 0.18, 0.25) });
    y -= 20;
  }
  page.drawText("Documento FICTICIO generado para la demo de SafeScan PYME.", {
    x: 60,
    y: 60,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.55),
  });
  return Buffer.from(await doc.save());
}

// ── Fixtures ──────────────────────────────────────────────────────────────

// Caso 1 (gestoría): ZIP con "ejecutable" camuflado (es texto inofensivo)
const fakeExe = Buffer.from(
  "Archivo de texto inofensivo para la demo de SafeScan PYME.\n" +
    "Simula un ejecutable camuflado (doble extensión). No es un programa real.\n",
  "utf8"
);
writeFileSync(
  path.join(OUT, "factura_urgente.zip"),
  buildZip([
    { name: "factura.pdf.exe", data: fakeExe },
    { name: "LEEME.txt", data: Buffer.from("Facturas del proveedor (demo).\n", "utf8") },
  ])
);

// Caso 2 (hotel): "Excel con macros" — texto CSV con datos ficticios de reservas
writeFileSync(
  path.join(OUT, "reservas_agosto.xlsm"),
  [
    "Reservas agosto — listado de clientes del hotel (DATOS FICTICIOS)",
    "cliente;email;telefono;reserva;canal",
    "Ana Torres;ana.torres@ejemplo.es;612345678;R-1203;booking",
    "Luis Prado;luis.prado@ejemplo.es;698765432;R-1204;check-in directo",
    "Eva Salas;eva.salas@ejemplo.es;655443322;R-1205;booking",
    "Mar Vidal;mar.vidal@ejemplo.es;677889900;R-1206;agencia",
    "Nota: pago pendiente de confirmar con el banco para la reserva R-1204.",
  ].join("\n"),
  "utf8"
);

// Caso 4 (autónomo): correo de phishing para pegar en la pestaña «Correo»
writeFileSync(
  path.join(OUT, "correo_phishing.txt"),
  [
    "De: facturacion@pagos-verificacion-urgente.top",
    "Asunto: ÚLTIMO AVISO: factura vencida — verificar pago en 24 horas",
    "",
    "Estimado cliente:",
    "Su cuenta quedará bloqueada si no verifica el pago pendiente de la factura 8123.",
    "Haga clic aquí para confirmar sus datos bancarios:",
    "http://pagos-verificacion-urgente.top/verificar?id=8123",
    "",
    "Departamento de facturación",
  ].join("\n"),
  "utf8"
);

const files = [
  // Caso 3 (clínica): PDF con datos sensibles FICTICIOS
  makePdf("Documentación del paciente (FICTICIA)", [
    "Paciente: Nombre Ficticio de Prueba",
    "DNI: 12345678Z",
    "Teléfono: 612 345 678",
    "IBAN de domiciliación: ES91 2100 0418 4502 0005 1332",
    "",
    "Historia clínica nº HC-2026-0042 (ficticia)",
    "Diagnóstico: datos simulados para la demostración.",
    "Tratamiento: datos simulados para la demostración.",
  ]).then((buf) => writeFileSync(path.join(OUT, "documentacion_paciente.pdf"), buf)),

  // Caso limpio + SafeDocs: dos PDFs cotidianos para unir
  makePdf("Acta de la reunión semanal", [
    "Asistentes: equipo de administración.",
    "Puntos tratados: planificación de la semana y turnos de agosto.",
    "Próxima reunión: lunes a las 9:00.",
  ]).then((buf) => writeFileSync(path.join(OUT, "acta_reunion.pdf"), buf)),

  makePdf("Presupuesto de marketing 2026", [
    "Partida 1: campañas locales.",
    "Partida 2: material impreso.",
    "Total estimado: 3.500 EUR (ficticio).",
  ]).then((buf) => writeFileSync(path.join(OUT, "presupuesto_marketing.pdf"), buf)),
];

await Promise.all(files);
console.log("✅ demo-files/ generado: factura_urgente.zip, reservas_agosto.xlsm,");
console.log("   documentacion_paciente.pdf, acta_reunion.pdf, presupuesto_marketing.pdf,");
console.log("   correo_phishing.txt");
