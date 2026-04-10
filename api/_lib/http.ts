const DEFAULT_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...DEFAULT_HEADERS,
      ...extraHeaders,
    },
  });
}

export function badRequest(message: string, details?: unknown) {
  return json({ error: message, details: details ?? null }, 400);
}

export function unauthorized(message = "Unauthorized") {
  return json({ error: message }, 401);
}

export function methodNotAllowed(message = "Method not allowed") {
  return json({ error: message }, 405);
}

export function serverError(
  message = "Internal server error",
  details?: unknown,
) {
  return json({ error: message, details: details ?? null }, 500);
}

export function options() {
  return new Response(null, {
    status: 204,
    headers: DEFAULT_HEADERS,
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  const raw = await request.text();

  if (!raw) {
    throw new Error("Empty request body");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}
