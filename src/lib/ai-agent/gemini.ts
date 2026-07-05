import { env } from "@/lib/env";
import { maskPiiInText } from "@/lib/containment/indicators";
import { MockAgentProvider } from "./mock";
import type {
  AgentChatContext,
  AgentProvider,
  ChatTurn,
  GeneratedReports,
  ReportInput,
} from "./types";

/**
 * Proveedor Gemini (Google Generative Language API, REST v1beta).
 *
 * Minimización de datos: el modelo solo recibe metadatos, puntuaciones,
 * señales e indicadores enmascarados. El archivo y su contenido NUNCA se
 * envían (garantizado por el tipo ReportInput).
 *
 * Ante cualquier error de red o de parseo se degrada al proveedor mock:
 * el MVP no se rompe nunca por la capa de IA.
 */

const SYSTEM_PROMPT = `Eres el agente privado de ciberseguridad de una pyme española (producto: SafeScan PYME).
Hablas SIEMPRE en español, con tono cercano, profesional y tranquilizador, para empleados sin conocimientos técnicos.

Reglas:
- Nunca pides ni procesas el contenido de archivos: trabajas solo con metadatos, puntuaciones y señales que te proporciona el sistema.
- Nunca inventas resultados de análisis: si no tienes datos, pides al usuario que suba el archivo, pegue la URL o describa el correo en la interfaz.
- Tu misión en el chat: entender qué ha recibido el usuario, pedirle que no lo abra, y guiarle a subirlo (clip), pegar la URL (pestaña URL) o describir el correo (pestaña Correo). También puedes recomendar SafeDocs para manipular PDFs cotidianos de forma privada.
- Respuestas breves (2-5 frases), claras y accionables. Sin jerga: nada de "hash", "sandbox" o "IOC" sin explicarlo en una palabra sencilla.
- Mensaje central del producto: "Pregunta antes de abrir". La privacidad durante el análisis también es ciberseguridad.`;

const REPORT_INSTRUCTIONS = `A partir del JSON de análisis que te paso (metadatos, puntuaciones y señales; el contenido del archivo NO existe para ti), genera los informes de SafeScan PYME.

Responde SOLO con un JSON válido con esta forma exacta:
{
  "employeeReport": "informe en markdown para el empleado: Resultado, Qué ha pasado, Qué debes hacer (lista), Qué no debes hacer, Privacidad durante el análisis, Consejo. Lenguaje llano, sin tecnicismos.",
  "adminReport": "informe en markdown para el responsable: hash/URL, tipo real, scores, señales, indicadores, flujo aplicado, proveedor de inteligencia, privacidad y trazabilidad, recomendación. Más técnico pero claro.",
  "finalRecommendation": "una sola frase con la recomendación final",
  "stepsForEmployee": ["paso 1", "paso 2", "..."]
}

El veredicto ya está decidido por el motor de políticas: NO lo cambies, explícalo.`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export class GeminiProvider implements AgentProvider {
  readonly name = "GeminiProvider";
  private readonly fallback = new MockAgentProvider();

  private async generate(
    contents: { role: string; parts: { text: string }[] }[],
    jsonMode: boolean
  ): Promise<string> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        }),
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) throw new Error("Gemini devolvió una respuesta vacía");
    return text;
  }

  async chat(turns: ChatTurn[], ctx: AgentChatContext): Promise<string> {
    try {
      const contents = [
        {
          role: "user",
          parts: [
            {
              text: `Contexto: empresa "${ctx.tenantName}" (sector: ${ctx.sector}), empleado: ${ctx.userName}.`,
            },
          ],
        },
        { role: "model", parts: [{ text: "Entendido. Soy el agente de seguridad de la empresa." }] },
        // Minimización de datos: el texto del usuario se enmascara (PII) antes
        // de salir hacia el modelo, igual que en la generación de informes.
        ...turns.slice(-12).map((t) => ({
          role: t.role === "user" ? "user" : "model",
          parts: [{ text: t.role === "user" ? maskPiiInText(t.content) : t.content }],
        })),
      ];
      return await this.generate(contents, false);
    } catch (err) {
      console.error("[gemini] chat falló, usando mock:", err);
      return this.fallback.chat(turns, ctx);
    }
  }

  async generateReports(input: ReportInput): Promise<GeneratedReports> {
    try {
      const text = await this.generate(
        [
          {
            role: "user",
            parts: [{ text: `${REPORT_INSTRUCTIONS}\n\nJSON de análisis:\n${JSON.stringify(input)}` }],
          },
        ],
        true
      );
      const parsed = JSON.parse(text) as Partial<GeneratedReports>;
      if (!parsed.employeeReport || !parsed.adminReport) {
        throw new Error("JSON de informes incompleto");
      }
      return {
        employeeReport: parsed.employeeReport,
        adminReport: parsed.adminReport,
        finalRecommendation: parsed.finalRecommendation ?? "",
        stepsForEmployee: parsed.stepsForEmployee ?? [],
      };
    } catch (err) {
      console.error("[gemini] informes fallaron, usando mock:", err);
      return this.fallback.generateReports(input);
    }
  }
}
