"use client";

import {
  FileArchive,
  FileCheck,
  FileHeart,
  FileSpreadsheet,
  Mail,
} from "lucide-react";

/**
 * Bandeja de archivos de ejemplo para la demo: se pueden ARRASTRAR al chat
 * o pulsar directamente. Son los mismos archivos inofensivos de demo-files/
 * (servidos como estáticos) y disparan el pipeline de análisis REAL —
 * el resultado no está enlatado.
 */

export const DEMO_FILE_MIME = "application/x-safescan-demo";

export interface DemoFile {
  name: string;
  label: string;
  Icon: typeof FileArchive;
  tone: string;
  /** Punto de color que anticipa el tipo de caso (rojo/ámbar/verde). */
  dot: string;
}

export const DEMO_FILES_LEFT: DemoFile[] = [
  {
    name: "factura_urgente.zip",
    label: "ZIP con ejecutable camuflado",
    Icon: FileArchive,
    tone: "text-red-500",
    dot: "bg-red-400",
  },
  {
    name: "correo_phishing.txt",
    label: "Correo con enlace de pago",
    Icon: Mail,
    tone: "text-red-500",
    dot: "bg-red-400",
  },
  {
    name: "reservas_agosto.xlsm",
    label: "Excel con macros y clientes",
    Icon: FileSpreadsheet,
    tone: "text-amber-500",
    dot: "bg-amber-400",
  },
];

export const DEMO_FILES_RIGHT: DemoFile[] = [
  {
    name: "documentacion_paciente.pdf",
    label: "PDF con datos de paciente",
    Icon: FileHeart,
    tone: "text-amber-500",
    dot: "bg-amber-400",
  },
  {
    name: "nominas_enero.csv",
    label: "Nóminas con DNI e IBAN",
    Icon: FileSpreadsheet,
    tone: "text-amber-500",
    dot: "bg-amber-400",
  },
  {
    name: "acta_reunion.pdf",
    label: "Documento limpio",
    Icon: FileCheck,
    tone: "text-emerald-500",
    dot: "bg-emerald-400",
  },
];

function DemoFileChip({
  file,
  onPick,
  disabled,
  compact,
}: {
  file: DemoFile;
  onPick: (name: string) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  const { name, label, Icon, tone, dot } = file;

  if (compact) {
    return (
      <button
        onClick={() => onPick(name)}
        disabled={disabled}
        title={label}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
      >
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        <span className="font-mono">{name}</span>
      </button>
    );
  }

  return (
    <button
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData(DEMO_FILE_MIME, name);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onPick(name)}
      disabled={disabled}
      title={`${label} — arrástralo al chat o haz clic para analizarlo`}
      className="group flex w-full cursor-grab flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition-all select-none hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md active:cursor-grabbing disabled:opacity-50"
    >
      <span className="relative">
        <Icon className={`h-9 w-9 ${tone}`} strokeWidth={1.6} />
        <span className={`absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full ${dot} ring-2 ring-white`} />
      </span>
      <span className="w-full truncate font-mono text-[11px] font-medium text-slate-700">{name}</span>
      <span className="text-[10px] leading-tight text-slate-400">{label}</span>
    </button>
  );
}

/** Columna lateral de archivos (pantallas grandes). */
export function DemoFilesColumn({
  files,
  onPick,
  disabled,
}: {
  files: DemoFile[];
  onPick: (name: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="hidden flex-col justify-center gap-3 lg:flex">
      {files.map((file) => (
        <DemoFileChip key={file.name} file={file} onPick={onPick} disabled={disabled} />
      ))}
    </div>
  );
}

/** Fila compacta de archivos (móvil/tablet). */
export function DemoFilesRow({
  onPick,
  disabled,
}: {
  onPick: (name: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-3 flex flex-wrap justify-center gap-1.5 lg:hidden">
      {[...DEMO_FILES_LEFT, ...DEMO_FILES_RIGHT].map((file) => (
        <DemoFileChip key={file.name} file={file} onPick={onPick} disabled={disabled} compact />
      ))}
    </div>
  );
}
