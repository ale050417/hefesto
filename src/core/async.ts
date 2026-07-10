/**
 * Corre una promesa con tope de tiempo. Para llamadas a servicios EXTERNOS
 * (MercadoPago, Resend) que no traen timeout propio: sin esto, un socket
 * colgado deja viva la función serverless hasta que Vercel la mata a los 300 s
 * ("Vercel Runtime Timeout Error", visto 2026-07-09).
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: tiempo de espera agotado (${ms} ms)`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
