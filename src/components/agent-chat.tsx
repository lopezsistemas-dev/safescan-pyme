"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Link2,
  Loader2,
  Mail,
  MessageSquareText,
  Paperclip,
  SendHorizonal,
  ShieldCheck,
} from "lucide-react";
import { Card } from "./ui";
import {
  DEMO_FILES_LEFT,
  DEMO_FILES_RIGHT,
  DEMO_FILE_MIME,
  DemoFilesColumn,
  DemoFilesRow,
} from "./demo-files-tray";

type Tab = "chat" | "url" | "email";

interface Message {
  role: "user" | "agent";
  content: string;
}

const QUICK_PROMPTS = [
  "Me ha llegado una factura rara",
  "Este enlace parece sospechoso",
  "Tengo un PDF con datos de clientes",
  "Quiero unir PDFs sin usar una web externa",
];

/** Chat con el agente de seguridad: mensaje, archivo, URL o correo. */
export function AgentChat({ tenantName, userName }: { tenantName: string; userName: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: `Hola, ${userName}. Soy el agente de seguridad de ${tenantName}. ¿Qué has recibido? Sube un archivo con el clip 📎, pega un enlace o describe un correo sospechoso. Y recuerda: no abras nada hasta que lo analicemos.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<Tab>("chat");
  const [urlValue, setUrlValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function pushMessage(message: Message) {
    setMessages((prev) => [...prev, message]);
  }

  async function apiError(res: Response, fallback: string): Promise<string> {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? fallback;
  }

  async function sendChat(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setError(null);
    pushMessage({ role: "user", content });
    setBusy("chat");
    try {
      const history = [...messages, { role: "user" as const, content }].slice(-20);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) throw new Error(await apiError(res, "El agente no pudo responder."));
      const data = (await res.json()) as { reply: string };
      pushMessage({ role: "agent", content: data.reply });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBusy(null);
    }
  }

  async function analyzeAndGo(promise: Promise<Response>, pendingNote: string) {
    setError(null);
    setBusy("analyze");
    pushMessage({ role: "agent", content: pendingNote });
    try {
      const res = await promise;
      if (!res.ok) throw new Error(await apiError(res, "No se pudo registrar el análisis."));
      const data = (await res.json()) as { analysisId: string };
      router.push(`/analisis/${data.analysisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setBusy(null);
    }
  }

  function onFileSelected(file: File | null) {
    if (!file) return;
    pushMessage({ role: "user", content: `He subido el archivo «${file.name}» para analizar.` });
    const formData = new FormData();
    formData.append("file", file);
    void analyzeAndGo(
      fetch("/api/analyze/file", { method: "POST", body: formData }),
      `No abras «${file.name}» todavía. Lo analizaré en el entorno seguro de ${tenantName}: cuarentena, tipo real, indicadores y sensibilidad. Te llevo al análisis…`
    );
  }

  /** Analiza uno de los archivos de ejemplo de la bandeja (demo). */
  async function handleDemoFile(name: string) {
    if (busy) return;
    setError(null);
    try {
      const res = await fetch(`/demo/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error("No se pudo cargar el archivo de ejemplo.");
      const blob = await res.blob();
      onFileSelected(new File([blob], name, { type: blob.type || "application/octet-stream" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const demoName = e.dataTransfer.getData(DEMO_FILE_MIME);
    if (demoName) {
      void handleDemoFile(demoName);
      return;
    }
    // También se aceptan archivos reales arrastrados desde el escritorio
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  }

  function onSubmitUrl() {
    const url = urlValue.trim();
    if (!url || busy) return;
    pushMessage({ role: "user", content: `¿Puedo abrir este enlace? ${url}` });
    setUrlValue("");
    void analyzeAndGo(
      fetch("/api/analyze/url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      }),
      "No pulses el enlace todavía. Voy a comprobar el dominio, su reputación y las señales de phishing…"
    );
  }

  function onSubmitEmail() {
    const text = emailValue.trim();
    if (!text || busy) return;
    pushMessage({ role: "user", content: `Me ha llegado este correo:\n\n${text.slice(0, 400)}${text.length > 400 ? "…" : ""}` });
    setEmailValue("");
    void analyzeAndGo(
      fetch("/api/analyze/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      }),
      "Gracias. Analizaré el texto del correo: enlaces, señales de presión y posibles datos sensibles…"
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-2">
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          ¿Qué has recibido?
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Pregunta antes de abrir. El análisis se hace en el entorno privado de {tenantName}.
          <span className="hidden lg:inline"> Arrastra un archivo de ejemplo al chat, o sube el tuyo.</span>
        </p>
      </div>

      <DemoFilesRow onPick={handleDemoFile} disabled={busy !== null} />

      <div className="lg:grid lg:grid-cols-[176px_minmax(0,1fr)_176px] lg:gap-4">
        <DemoFilesColumn files={DEMO_FILES_LEFT} onPick={handleDemoFile} disabled={busy !== null} />

        <div
          className="relative mx-auto w-full max-w-3xl"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
          }}
          onDrop={onDrop}
        >
          {dragOver ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/85">
              <p className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-md">
                <ShieldCheck className="h-4.5 w-4.5" />
                Suelta el archivo: lo analizaré en el entorno seguro
              </p>
            </div>
          ) : null}

          <Card className="flex h-[64vh] max-h-[720px] min-h-[440px] flex-col overflow-hidden">
        {/* Hilo de mensajes */}
        <div
          ref={scrollRef}
          className="chat-scroll flex-1 space-y-4 overflow-y-auto p-5"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-atomic="false"
          aria-label="Conversación con el agente de seguridad"
        >
          {messages.map((message, i) =>
            message.role === "agent" ? (
              <div key={i} className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                  {message.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white">
                  {message.content}
                </div>
              </div>
            )
          )}
          {busy ? (
            <div role="status" className="flex items-center gap-2 pl-11 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {busy === "analyze" ? "Preparando el análisis…" : "El agente está escribiendo…"}
            </div>
          ) : null}
        </div>

        {/* Sugerencias rápidas */}
        {messages.length <= 1 ? (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendChat(prompt)}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mx-5 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        {/* Compositor con pestañas */}
        <div className="border-t border-slate-200 bg-white p-3">
          <div className="mb-2 flex gap-1">
            {(
              [
                { id: "chat", label: "Mensaje", Icon: MessageSquareText },
                { id: "url", label: "URL", Icon: Link2 },
                { id: "email", label: "Correo", Icon: Mail },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === id ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {tab === "chat" ? (
            <div className="flex items-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy !== null}
                title="Subir archivo sospechoso para analizar"
                aria-label="Subir archivo sospechoso para analizar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50"
              >
                <Paperclip className="h-5 w-5" aria-hidden="true" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                aria-label="Archivo a analizar"
                onChange={(e) => {
                  onFileSelected(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
                rows={1}
                placeholder="Cuéntame qué ha pasado o sube el archivo aquí…"
                className="max-h-32 min-h-10 flex-1 resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <button
                onClick={() => sendChat()}
                disabled={busy !== null || !input.trim()}
                aria-label="Enviar mensaje"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
              >
                <SendHorizonal className="h-4.5 w-4.5" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {tab === "url" ? (
            <div className="flex items-center gap-2">
              <input
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSubmitUrl()}
                placeholder="Pega aquí el enlace sospechoso (https://…)"
                className="h-10 flex-1 rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <button
                onClick={onSubmitUrl}
                disabled={busy !== null || !urlValue.trim()}
                className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
              >
                Analizar URL
              </button>
            </div>
          ) : null}

          {tab === "email" ? (
            <div className="space-y-2">
              <textarea
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                rows={4}
                placeholder="Pega el texto del correo sospechoso o descríbelo (remitente, asunto, qué pide…)"
                className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <div className="flex justify-end">
                <button
                  onClick={onSubmitEmail}
                  disabled={busy !== null || emailValue.trim().length < 10}
                  className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
                >
                  Analizar correo
                </button>
              </div>
            </div>
          ) : null}
        </div>
          </Card>
        </div>

        <DemoFilesColumn files={DEMO_FILES_RIGHT} onPick={handleDemoFile} disabled={busy !== null} />
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-600">
        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
        El agente nunca recibe el contenido de tus archivos: solo metadatos, puntuaciones y señales.
        Los archivos de ejemplo son inofensivos y contienen datos ficticios.
      </p>
    </div>
  );
}
