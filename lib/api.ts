// Única puerta de entrada del sitio al sistema: el API Gateway
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.');
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 502 || response.status === 503) {
      throw new ApiError(response.status, 'Un servicio se está despertando. Espera unos segundos e intenta de nuevo.');
    }
    const message = (data as { message?: string | string[] } | null)?.message;
    throw new ApiError(
      response.status,
      Array.isArray(message) ? message.join('. ') : (message ?? `El servidor respondió con el código ${response.status}`),
    );
  }
  return data as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado';
}
