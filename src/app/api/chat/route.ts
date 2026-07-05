import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { jsonError, requireSession } from "@/lib/api-helpers";
import { getAgentProvider } from "@/lib/ai-agent";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "agent"]),
        content: z.string().trim().min(1).max(4000),
      })
    )
    .min(1)
    .max(30),
});

/** Conversación con el agente de seguridad (Gemini o mock). */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireSession();
  if (error) return error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Mensaje no válido.");

  const agent = getAgentProvider();
  const reply = await agent.chat(parsed.data.messages, {
    tenantName: ctx.tenant.name,
    sector: ctx.tenant.sector,
    userName: ctx.user.name,
  });

  return NextResponse.json({ reply, provider: env.agentIsMock ? "mock" : "gemini" });
}
