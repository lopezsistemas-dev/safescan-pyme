import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  FileStack,
  Fingerprint,
  LayoutDashboard,
  Lock,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Card } from "@/components/ui";

/** Landing interna del producto: qué es SafeScan PYME y cómo se demuestra. */

const MODULES = [
  {
    Icon: MessagesSquare,
    title: "SafeScan Agent",
    text: "Chat con el agente de seguridad de tu empresa: sube archivos, pega URLs o describe un correo sospechoso.",
  },
  {
    Icon: ScanSearch,
    title: "Containment Engine",
    text: "Cuarentena, hash SHA-256, tipo real por firma binaria, dobles extensiones e indicadores extraídos.",
  },
  {
    Icon: Workflow,
    title: "Policy & Privacy Engine",
    text: "Dos puntuaciones (amenaza y sensibilidad) deciden el flujo: hash, URL, Private Scanning, local o revisión humana.",
  },
  {
    Icon: Fingerprint,
    title: "VirusTotal / Google TI",
    text: "VirusTotal/Google aporta la inteligencia. Conector real preparado y modo simulado para la demo.",
  },
  {
    Icon: FileStack,
    title: "SafeDocs",
    text: "Unir, extraer páginas, rotar y limpiar metadatos de PDFs sin salir del entorno privado de la empresa.",
  },
  {
    Icon: LayoutDashboard,
    title: "Dashboard del responsable",
    text: "Historial, informes, cuarentena, auditoría y decisiones claras para quien gestiona la seguridad.",
  },
];

const ROADMAP = [
  {
    phase: "Fase MVP (julio-agosto)",
    current: true,
    items: [
      "Chat del agente, subida segura y cuarentena",
      "Policy & Privacy Engine con doble scoring",
      "Análisis mock/real por hash y URL",
      "SafeDocs básico y dashboard del responsable",
    ],
  },
  {
    phase: "Fase 2",
    current: false,
    items: [
      "Voz con Gemini Live API",
      "Integración real autorizada con Private Scanning",
      "Autenticación real y dominios personalizados",
      "Conectores de correo y alertas a responsables",
    ],
  },
  {
    phase: "Fase 3",
    current: false,
    items: [
      "Modelo MSSP/partner y multitenancy robusto",
      "Facturación y auditoría avanzada",
      "DLP avanzado, CDR y OCR",
      "Integraciones con Google Workspace y Microsoft 365",
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-base font-bold text-slate-900">
              SafeScan <span className="text-brand-600">PYME</span>
            </span>
          </div>
          <Link
            href="/seleccionar-empresa"
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Entrar en la demo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-12 text-center">
        <p className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          <Lock className="h-3.5 w-3.5" />
          La privacidad durante el análisis también es ciberseguridad
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold tracking-tight text-slate-900">
          Pregunta antes de abrir.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          El agente privado de ciberseguridad para pymes y autónomos. Un empleado recibe algo
          sospechoso, pregunta al agente y recibe una decisión clara:{" "}
          <strong className="text-slate-800">abrir, bloquear o escalar</strong>.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/seleccionar-empresa"
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-brand-700"
          >
            <Building2 className="h-5 w-5" /> Elegir empresa demo
          </Link>
          <span className="text-sm text-slate-500">
            3 pymes simuladas · 5 casos reales de demo · funciona sin claves de API
          </span>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-3 text-left sm:grid-cols-3">
          {[
            "Un archivo puede ser peligroso por contener malware, pero también por contener datos sensibles.",
            "El empleado no necesita saber de ciberseguridad. Solo necesita saber qué hacer.",
            "VirusTotal/Google aporta la inteligencia. Gemini aporta la conversación. SafeScan aporta la experiencia privada para la pyme.",
          ].map((phrase, i) => (
            <Card key={i} className="p-4">
              <p className="text-sm leading-relaxed text-slate-600">“{phrase}”</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="border-y border-slate-200 bg-white py-12">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            El producto en 5 segundos
          </h2>
          <div className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-4">
            {[
              { n: "1", t: "Un empleado recibe un archivo, enlace o correo sospechoso" },
              { n: "2", t: "Se lo entrega al agente: cuarentena inmediata, sin abrirlo" },
              { n: "3", t: "SafeScan analiza con privacidad: hash, indicadores, políticas e inteligencia" },
              { n: "4", t: "Respuesta clara: abrir, precaución, bloquear, escalar o cuarentena" },
            ].map((step) => (
              <div key={step.n} className="text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                  {step.n}
                </span>
                <p className="mt-2 text-sm text-slate-600">{step.t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Módulos */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold text-slate-900">Arquitectura del MVP</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
          No todos los archivos deben analizarse igual. SafeScan decide el flujo adecuado según
          riesgo y sensibilidad.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ Icon, title, text }) => (
            <Card key={title} className="p-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">Roadmap</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ROADMAP.map((phase) => (
              <Card
                key={phase.phase}
                className={`p-5 ${phase.current ? "border-brand-300 ring-2 ring-brand-100" : ""}`}
              >
                <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                  {phase.phase}
                  {phase.current ? (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                      Este MVP
                    </span>
                  ) : null}
                </h3>
                <ul className="mt-3 space-y-2">
                  {phase.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-slate-400">
        <p className="flex items-center justify-center gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          SafeScan PYME · MVP académico · Premios de la Cátedra de Ciberseguridad UMA — VirusTotal/Google
        </p>
      </footer>
    </div>
  );
}
