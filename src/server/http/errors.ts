// Error de dominio con su código HTTP y el `codigo` del contrato (openapi.yaml, docs/03).
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

const json = (status: number, codigo: string, mensaje: string) =>
  Response.json({ error: { codigo, mensaje } }, { status });

export function toResponse(err: unknown): Response {
  if (err instanceof AppError) return json(err.status, err.codigo, err.message);
  console.error("[api] error inesperado", err);
  return json(500, "ERROR_INTERNO", "Error interno del servidor");
}

// Envuelve un Route Handler: cualquier error sale como JSON del contrato, nunca como stack o HTML.
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return toResponse(err);
    }
  };
}
