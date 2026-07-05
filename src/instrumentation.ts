/**
 * Hook de arranque de Next.js: al iniciar el servidor se ejecuta la
 * limpieza de archivos expirados (política de retención).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { sweepExpiredFiles } = await import("@/lib/retention");
    try {
      const { quarantine, safedocs } = await sweepExpiredFiles();
      if (quarantine + safedocs > 0) {
        console.log(
          `[retención] Limpieza al arrancar: ${quarantine} archivo(s) de cuarentena y ${safedocs} documento(s) SafeDocs eliminados.`
        );
      }
    } catch (err) {
      console.error("[retención] Error en la limpieza inicial:", err);
    }
  }
}
