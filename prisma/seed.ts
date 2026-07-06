/**
 * Seed de SafeScan PYME — datos demo para la evaluación del MVP.
 *
 * Crea 3 empresas (tenants) con usuarios, políticas propias y un historial
 * de análisis que cubre los casos demo de la memoria del proyecto:
 *   1. Gestoría  → factura_urgente.zip        → BLOQUEAR
 *   2. Hotel     → reservas_agosto.xlsm       → Private Scanning (simulado)
 *   3. Clínica   → documentacion_paciente.pdf → revisión humana
 *   4. Autónomo  → URL de pago sospechosa     → BLOQUEAR
 *   5. SafeDocs  → unión de PDFs con datos de clientes
 *
 * Los archivos de los análisis históricos ya no existen en disco: se
 * marcan como eliminados por la política de retención (comportamiento real).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000);
}

async function main() {
  // Limpieza previa (orden inverso a las FK)
  await prisma.storedFile.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.indicator.deleteMany();
  await prisma.safeDocsJob.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // ── Tenants ────────────────────────────────────────────────────────────
  const asesoria = await prisma.tenant.create({
    data: {
      name: "Asesoría López",
      domain: "seguridad.asesorialopez.es",
      sector: "Gestoría y asesoría",
      policy: JSON.stringify({
        umbralAmenaza: 60,
        umbralSensibilidad: 60,
        bloquearEjecutables: true,
        privateScanningPreferido: false,
        notificarResponsable: true,
        palabrasSensiblesExtra: ["modelo 303", "renta", "seguridad social"],
      }),
    },
  });

  const hotel = await prisma.tenant.create({
    data: {
      name: "Hotel Málaga Centro",
      domain: "scan.hotelmalaga.com",
      sector: "Hostelería y turismo",
      policy: JSON.stringify({
        umbralAmenaza: 60,
        umbralSensibilidad: 55,
        bloquearEjecutables: true,
        privateScanningPreferido: true,
        notificarResponsable: true,
        palabrasSensiblesExtra: ["reserva", "huésped", "check-in", "booking"],
      }),
    },
  });

  const clinica = await prisma.tenant.create({
    data: {
      name: "Clínica Sur",
      domain: "proteccion.clinicasur.es",
      sector: "Salud",
      policy: JSON.stringify({
        umbralAmenaza: 50,
        umbralSensibilidad: 40, // política estricta: datos de pacientes
        bloquearEjecutables: true,
        privateScanningPreferido: true,
        notificarResponsable: true,
        palabrasSensiblesExtra: ["paciente", "historia clínica", "diagnóstico", "tratamiento"],
      }),
    },
  });

  // ── Usuarios ───────────────────────────────────────────────────────────
  const [carmen, pablo] = await Promise.all([
    prisma.user.create({
      data: { tenantId: asesoria.id, name: "Carmen López", role: "RESPONSABLE", email: "carmen@asesorialopez.es" },
    }),
    prisma.user.create({
      data: { tenantId: asesoria.id, name: "Pablo Ruiz", role: "EMPLEADO", email: "pablo@asesorialopez.es" },
    }),
  ]);

  const [lucia, andres] = await Promise.all([
    prisma.user.create({
      data: { tenantId: hotel.id, name: "Lucía Romero", role: "RESPONSABLE", email: "lucia@hotelmalaga.com" },
    }),
    prisma.user.create({
      data: { tenantId: hotel.id, name: "Andrés Vega", role: "EMPLEADO", email: "andres@hotelmalaga.com" },
    }),
  ]);

  const [marta, javier] = await Promise.all([
    prisma.user.create({
      data: { tenantId: clinica.id, name: "Marta Díaz", role: "RESPONSABLE", email: "marta@clinicasur.es" },
    }),
    prisma.user.create({
      data: { tenantId: clinica.id, name: "Javier Molina", role: "EMPLEADO", email: "javier@clinicasur.es" },
    }),
  ]);

  // ── Caso 1: Gestoría — factura_urgente.zip → BLOQUEAR ─────────────────
  const caso1 = await prisma.analysis.create({
    data: {
      tenantId: asesoria.id,
      userId: pablo.id,
      inputType: "FILE",
      originalName: "factura_urgente.zip",
      sha256: "3f8e1c2ab54d0f6c9e7b21aa8cd430fe9a12bc45d67e890f1a2b3c4d5e6f7a8b",
      mimeType: "application/zip",
      realType: "Archivo comprimido ZIP",
      fileSize: 384_512,
      status: "COMPLETADO",
      progressStage: "Análisis completado",
      progressPct: 100,
      threatScore: 92,
      sensitivityScore: 35,
      recommendedFlow: "QUARANTINE",
      finalVerdict: "BLOQUEAR",
      providerUsed: "MockThreatIntelligence (simulación VirusTotal)",
      privateScanningUsed: false,
      mockMode: true,
      quarantined: true,
      fileDeleted: true, // eliminado por política de retención (24 h)
      resolved: true,
      createdAt: hoursAgo(70),
      employeeReport: [
        "**Resultado: BLOQUEAR — riesgo alto**",
        "",
        "**Qué ha pasado:** el ZIP que has recibido contiene un archivo que se hace pasar por una factura en PDF, pero en realidad es un programa ejecutable (factura.pdf.exe). Es una técnica típica de fraude.",
        "",
        "**Qué debes hacer:** no abras el archivo. No lo reenvíes a nadie. Avisa a tu responsable (ya ha sido notificado). El archivo queda en cuarentena y se eliminará automáticamente.",
        "",
        "**Qué no debes hacer:** no respondas al remitente ni descargues de nuevo el adjunto.",
        "",
        "**Consejo:** una factura real nunca llega como programa ejecutable. Ante la duda, pregunta siempre antes de abrir.",
      ].join("\n"),
      adminReport: [
        "## Informe técnico — factura_urgente.zip",
        "",
        "- **SHA-256:** 3f8e1c2ab54d0f6c9e7b21aa8cd430fe9a12bc45d67e890f1a2b3c4d5e6f7a8b",
        "- **Tipo declarado:** application/zip · **Tipo real:** ZIP",
        "- **Señales:** ejecutable camuflado con doble extensión (factura.pdf.exe) dentro del comprimido; remitente no habitual.",
        "- **Threat Score:** 92/100 · **Sensitivity Score:** 35/100",
        "- **Flujo aplicado:** QUARANTINE (política: bloquear ejecutables).",
        "- **Proveedor:** simulación VirusTotal (modo mock del MVP). 41/70 motores marcarían este patrón como malicioso según el modelo de simulación.",
        "- **Privacidad:** el archivo no salió del entorno de cuarentena. No se envió contenido a servicios externos.",
        "- **Recomendación:** mantener bloqueo, avisar al remitente legítimo por otro canal y reforzar el aviso interno sobre facturas comprimidas.",
      ].join("\n"),
      policyJson: JSON.stringify({
        reason: "Ejecutable camuflado con doble extensión dentro de archivo comprimido",
        securityExplanation: "El ZIP contiene factura.pdf.exe: un ejecutable disfrazado de PDF. Patrón clásico de malware bancario.",
        privacyExplanation: "El contenido no era sensible; el riesgo dominante es la amenaza. El archivo permaneció en cuarentena local.",
      }),
      tiJson: JSON.stringify({
        verdict: "malicious",
        detections: "41/70",
        reputation: -78,
        matchedThreats: ["Trojan.GenericKD (simulado)", "Mal/DoubleExt-A (simulado)"],
        providerUsed: "MockThreatIntelligenceProvider",
        privateScanningUsed: false,
      }),
    },
  });

  await prisma.indicator.createMany({
    data: [
      { analysisId: caso1.id, type: "KEYWORD", value: "Doble extensión: factura.pdf.exe", risk: "ALTO" },
      { analysisId: caso1.id, type: "KEYWORD", value: "Ejecutable dentro de ZIP", risk: "ALTO" },
      { analysisId: caso1.id, type: "HASH", value: "3f8e1c2a…e6f7a8b (SHA-256)", risk: "ALTO" },
      { analysisId: caso1.id, type: "KEYWORD", value: "Palabra de presión: “urgente”", risk: "MEDIO" },
    ],
  });

  // ── Caso 2: Hotel — reservas_agosto.xlsm → Private Scanning simulado ──
  const caso2 = await prisma.analysis.create({
    data: {
      tenantId: hotel.id,
      userId: andres.id,
      inputType: "FILE",
      originalName: "reservas_agosto.xlsm",
      sha256: "9a1b7c33e02d45f68a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f",
      mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      realType: "Hoja de cálculo Excel con macros (XLSM)",
      fileSize: 1_204_224,
      status: "COMPLETADO",
      progressStage: "Análisis completado",
      progressPct: 100,
      threatScore: 78,
      sensitivityScore: 82,
      recommendedFlow: "PRIVATE_SCANNING",
      finalVerdict: "ESCALAR",
      providerUsed: "MockThreatIntelligence (Private Scanning simulado)",
      privateScanningUsed: true,
      mockMode: true,
      quarantined: true,
      fileDeleted: true,
      resolved: false,
      createdAt: hoursAgo(30),
      employeeReport: [
        "**Resultado: ESCALAR — necesita revisión del responsable**",
        "",
        "**Qué ha pasado:** el Excel contiene macros (instrucciones automáticas) y además incluye datos de clientes: nombres, emails y teléfonos de reservas. Es a la vez un posible riesgo y un documento sensible.",
        "",
        "**Qué debes hacer:** no lo abras todavía y no actives las macros si alguien te lo pide. Tu responsable ha recibido el informe y decidirá el siguiente paso.",
        "",
        "**Privacidad:** por contener datos de clientes, el análisis se ha hecho por el flujo privado de tu empresa. El documento no se ha compartido fuera.",
        "",
        "**Consejo:** un listado de reservas no necesita macros. Si un Excel te pide “habilitar contenido”, desconfía.",
      ].join("\n"),
      adminReport: [
        "## Informe técnico — reservas_agosto.xlsm",
        "",
        "- **SHA-256:** 9a1b7c33…c9d0e1f",
        "- **Tipo:** XLSM (Excel con macros habilitadas)",
        "- **Señales de amenaza:** macros presentes; enlace externo a dominio no relacionado con el remitente.",
        "- **Señales de sensibilidad:** ~120 filas con nombres, emails y teléfonos de huéspedes; palabras clave “reserva”, “cliente”.",
        "- **Threat Score:** 78/100 · **Sensitivity Score:** 82/100",
        "- **Flujo aplicado:** PRIVATE_SCANNING (simulado en el MVP). El archivo se trató como sensible: sin subida a corpus público, visibilidad limitada al tenant, retención corta.",
        "- **Recomendación:** verificar el remitente por otro canal antes de decidir; si no se confirma, bloquear y eliminar. Revisar si el listado de reservas debería circular por correo.",
      ].join("\n"),
      policyJson: JSON.stringify({
        reason: "Documento con macros y datos personales de clientes: amenaza y sensibilidad altas a la vez",
        securityExplanation: "Las macros permiten ejecutar código al abrir el documento. Combinadas con un remitente dudoso, son la vía de entrada más común en pymes.",
        privacyExplanation: "El documento contiene datos personales de huéspedes. La política del hotel prioriza Private Scanning: análisis sin exposición pública del contenido.",
      }),
      tiJson: JSON.stringify({
        verdict: "suspicious",
        detections: "12/70",
        reputation: -35,
        matchedThreats: ["Doc.Macro.Generic (simulado)"],
        providerUsed: "MockThreatIntelligenceProvider",
        privateScanningUsed: true,
        note: "Private Scanning simulado para MVP académico. Conector preparado para integración autorizada.",
      }),
    },
  });

  await prisma.indicator.createMany({
    data: [
      { analysisId: caso2.id, type: "KEYWORD", value: "Macros habilitadas (.xlsm)", risk: "ALTO" },
      { analysisId: caso2.id, type: "EMAIL", value: "~120 emails de huéspedes detectados", risk: "ALTO" },
      { analysisId: caso2.id, type: "PHONE", value: "Teléfonos de clientes detectados", risk: "MEDIO" },
      { analysisId: caso2.id, type: "KEYWORD", value: "Palabras sensibles: reserva, cliente", risk: "MEDIO" },
      { analysisId: caso2.id, type: "DOMAIN", value: "enlace externo a dominio no corporativo", risk: "MEDIO" },
    ],
  });

  // ── Caso 3: Clínica — documentacion_paciente.pdf → revisión humana ────
  const caso3 = await prisma.analysis.create({
    data: {
      tenantId: clinica.id,
      userId: javier.id,
      inputType: "FILE",
      originalName: "documentacion_paciente.pdf",
      sha256: "c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5",
      mimeType: "application/pdf",
      realType: "Documento PDF",
      fileSize: 892_416,
      status: "COMPLETADO",
      progressStage: "Análisis completado",
      progressPct: 100,
      threatScore: 15,
      sensitivityScore: 95,
      recommendedFlow: "HUMAN_REVIEW",
      finalVerdict: "ESCALAR",
      providerUsed: "Análisis local (sin envío externo)",
      privateScanningUsed: false,
      mockMode: true,
      quarantined: true,
      fileDeleted: true,
      resolved: true,
      createdAt: hoursAgo(50),
      employeeReport: [
        "**Resultado: ESCALAR — documento muy sensible**",
        "",
        "**Qué ha pasado:** el PDF no muestra señales de amenaza, pero contiene datos de salud y documentos identificativos de un paciente (DNI, historia clínica). Es información especialmente protegida.",
        "",
        "**Qué debes hacer:** no lo reenvíes por correo ni lo subas a herramientas externas. La responsable de la clínica ha sido avisada para decidir el tratamiento adecuado.",
        "",
        "**Privacidad:** por su altísima sensibilidad, el análisis se ha hecho íntegramente en local. El documento no ha salido del entorno de la clínica.",
        "",
        "**Consejo:** para manipular este tipo de documentos (unir, separar, limpiar metadatos), usa SafeDocs: todo se hace dentro del entorno privado.",
      ].join("\n"),
      adminReport: [
        "## Informe técnico — documentacion_paciente.pdf",
        "",
        "- **SHA-256:** c4d5e6f7…a2b3c4d5",
        "- **Tipo:** PDF (sin JavaScript embebido, sin enlaces externos)",
        "- **Señales de sensibilidad:** DNI detectado, datos de salud (categoría especial RGPD), nombre completo del paciente, palabras clave clínicas.",
        "- **Threat Score:** 15/100 · **Sensitivity Score:** 95/100",
        "- **Flujo aplicado:** HUMAN_REVIEW + LOCAL_ONLY. La política de Clínica Sur impide el envío externo de documentación de pacientes; no se consultó ningún servicio externo con el contenido.",
        "- **Recomendación:** confirmar el canal de recepción con el paciente, archivar en el sistema clínico autorizado y eliminar la copia del correo. Valorar formación sobre canales seguros.",
      ].join("\n"),
      policyJson: JSON.stringify({
        reason: "Sensibilidad extrema (datos de salud + DNI) con amenaza baja: el riesgo es la exposición, no el malware",
        securityExplanation: "Sin macros, sin ejecutables, sin enlaces sospechosos. El PDF es técnicamente inofensivo.",
        privacyExplanation: "Datos de categoría especial (salud). La política estricta de la clínica fuerza análisis exclusivamente local y revisión humana. Ningún dato salió del entorno.",
      }),
      tiJson: JSON.stringify({
        verdict: "clean",
        detections: "0/70",
        reputation: 0,
        matchedThreats: [],
        providerUsed: "LOCAL_ONLY (sin consulta externa por política de privacidad)",
        privateScanningUsed: false,
      }),
    },
  });

  await prisma.indicator.createMany({
    data: [
      { analysisId: caso3.id, type: "DNI", value: "DNI detectado (enmascarado: ***4567**)", risk: "ALTO" },
      { analysisId: caso3.id, type: "KEYWORD", value: "Datos de salud: historia clínica, diagnóstico", risk: "ALTO" },
      { analysisId: caso3.id, type: "PHONE", value: "Teléfono personal detectado", risk: "MEDIO" },
      { analysisId: caso3.id, type: "KEYWORD", value: "Palabra sensible: paciente", risk: "MEDIO" },
    ],
  });

  // ── Caso 4: Autónomo (asesoría) — URL de pago sospechosa → BLOQUEAR ───
  const caso4 = await prisma.analysis.create({
    data: {
      tenantId: asesoria.id,
      userId: pablo.id,
      inputType: "URL",
      originalName: null,
      inputValue: "http://pagos-verificacion-urgente.top/verificar?id=8123",
      status: "COMPLETADO",
      progressStage: "Análisis completado",
      progressPct: 100,
      threatScore: 88,
      sensitivityScore: 5,
      recommendedFlow: "URL_LOOKUP",
      finalVerdict: "BLOQUEAR",
      providerUsed: "MockThreatIntelligence (simulación VirusTotal)",
      privateScanningUsed: false,
      mockMode: true,
      quarantined: false,
      fileDeleted: false,
      resolved: true,
      createdAt: hoursAgo(8),
      employeeReport: [
        "**Resultado: BLOQUEAR — probable phishing**",
        "",
        "**Qué ha pasado:** el enlace apunta a un dominio recién creado que imita una página de pagos y usa presión de urgencia. Todo indica que es una campaña de phishing para robar datos bancarios.",
        "",
        "**Qué debes hacer:** no pulses el enlace ni introduzcas ningún dato. Elimina el mensaje. Si ya has introducido datos, avisa inmediatamente a tu banco y a tu responsable.",
        "",
        "**Consejo:** ningún proveedor legítimo te pedirá pagar desde un dominio extraño. Comprueba siempre el dominio real antes de pagar.",
      ].join("\n"),
      adminReport: [
        "## Informe técnico — URL sospechosa",
        "",
        "- **URL:** hxxp://pagos-verificacion-urgente[.]top/verificar?id=8123 (desactivada)",
        "- **Señales:** TLD .top de bajo coste, dominio de reciente creación, léxico de presión (“urgente”), HTTP sin cifrar, patrón de verificación de pago.",
        "- **Threat Score:** 88/100 · **Sensitivity Score:** 5/100",
        "- **Flujo aplicado:** URL_LOOKUP — solo se consultó la reputación de la URL; ningún contenido de la empresa salió del entorno.",
        "- **Proveedor:** simulación VirusTotal (mock). 17/70 motores marcarían phishing según el modelo de simulación.",
        "- **Recomendación:** bloquear el dominio en el filtro de correo y avisar al equipo del patrón de campaña.",
      ].join("\n"),
      policyJson: JSON.stringify({
        reason: "Dominio sospechoso con patrón de phishing de pago",
        securityExplanation: "Dominio .top recién registrado, sin HTTPS, con léxico de urgencia: patrón clásico de phishing bancario.",
        privacyExplanation: "Analizar una URL no expone documentos: solo se consulta reputación del dominio. Riesgo de privacidad nulo.",
      }),
      tiJson: JSON.stringify({
        verdict: "malicious",
        detections: "17/70",
        reputation: -64,
        matchedThreats: ["Phishing.PaymentScam (simulado)"],
        providerUsed: "MockThreatIntelligenceProvider",
        privateScanningUsed: false,
      }),
    },
  });

  await prisma.indicator.createMany({
    data: [
      { analysisId: caso4.id, type: "URL", value: "http://pagos-verificacion-urgente.top/verificar?id=8123", risk: "ALTO" },
      { analysisId: caso4.id, type: "DOMAIN", value: "pagos-verificacion-urgente.top", risk: "ALTO" },
      { analysisId: caso4.id, type: "KEYWORD", value: "Léxico de presión: “urgente”, “verificar”", risk: "MEDIO" },
    ],
  });

  // ── Caso 5: Hotel — SafeDocs: unir PDFs con datos de clientes ─────────
  await prisma.safeDocsJob.create({
    data: {
      tenantId: hotel.id,
      userId: lucia.id,
      operation: "UNIR",
      inputFiles: JSON.stringify(["contrato_touroperador.pdf", "anexo_tarifas_2026.pdf"]),
      outputFile: null, // ya eliminado por retención
      status: "COMPLETADO",
      createdAt: hoursAgo(26),
    },
  });

  // ── Auditoría ──────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { tenantId: asesoria.id, userId: pablo.id, analysisId: caso1.id, action: "ARCHIVO_RECIBIDO", details: "factura_urgente.zip recibido en cuarentena", createdAt: hoursAgo(70) },
      { tenantId: asesoria.id, userId: pablo.id, analysisId: caso1.id, action: "ANALISIS_COMPLETADO", details: "Veredicto BLOQUEAR (threat 92, sensibilidad 35). Flujo QUARANTINE.", createdAt: hoursAgo(70) },
      { tenantId: asesoria.id, userId: carmen.id, analysisId: caso1.id, action: "MARCADO_RESUELTO", details: "Revisado por la responsable. Remitente confirmado como fraudulento.", createdAt: hoursAgo(66) },
      { tenantId: asesoria.id, userId: null, analysisId: caso1.id, action: "RETENCION_APLICADA", details: "Archivo eliminado de cuarentena tras 24 h de retención.", createdAt: hoursAgo(46) },
      { tenantId: hotel.id, userId: andres.id, analysisId: caso2.id, action: "ARCHIVO_RECIBIDO", details: "reservas_agosto.xlsm recibido en cuarentena", createdAt: hoursAgo(30) },
      { tenantId: hotel.id, userId: andres.id, analysisId: caso2.id, action: "ANALISIS_COMPLETADO", details: "Veredicto ESCALAR (threat 78, sensibilidad 82). Flujo PRIVATE_SCANNING simulado.", createdAt: hoursAgo(30) },
      { tenantId: hotel.id, userId: null, analysisId: caso2.id, action: "RETENCION_APLICADA", details: "Archivo eliminado de cuarentena tras 24 h de retención.", createdAt: hoursAgo(5) },
      { tenantId: clinica.id, userId: javier.id, analysisId: caso3.id, action: "ARCHIVO_RECIBIDO", details: "documentacion_paciente.pdf recibido en cuarentena", createdAt: hoursAgo(50) },
      { tenantId: clinica.id, userId: javier.id, analysisId: caso3.id, action: "ANALISIS_COMPLETADO", details: "Veredicto ESCALAR (threat 15, sensibilidad 95). Flujo HUMAN_REVIEW, análisis solo local.", createdAt: hoursAgo(50) },
      { tenantId: clinica.id, userId: marta.id, analysisId: caso3.id, action: "MARCADO_RESUELTO", details: "Documento archivado en el sistema clínico autorizado.", createdAt: hoursAgo(44) },
      { tenantId: asesoria.id, userId: pablo.id, analysisId: caso4.id, action: "URL_ANALIZADA", details: "URL de pago sospechosa analizada: BLOQUEAR.", createdAt: hoursAgo(8) },
      { tenantId: hotel.id, userId: lucia.id, analysisId: null, action: "SAFEDOCS_UNIR", details: "2 PDFs unidos en el entorno privado (contrato_touroperador.pdf + anexo_tarifas_2026.pdf).", createdAt: hoursAgo(26) },
    ],
  });

  console.log("✅ Seed completado:");
  console.log("   - 3 empresas demo (Asesoría López, Hotel Málaga Centro, Clínica Sur)");
  console.log("   - 6 usuarios (empleado + responsable por empresa)");
  console.log("   - 4 análisis históricos (casos demo 1-4) + 1 trabajo SafeDocs (caso 5)");
  console.log("   - Registros de auditoría");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
