import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/tenant";
import { AgentChat } from "@/components/agent-chat";

export const dynamic = "force-dynamic";

/** Home del agente: la pantalla principal del producto. */
export default async function AgentPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/seleccionar-empresa");

  return (
    <AgentChat
      tenantName={ctx.tenant.name}
      userName={ctx.user.name.split(" ")[0]}
    />
  );
}
