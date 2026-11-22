import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { isProduction } from "@/lib/env";

/** Typed application error — surfaces as a structured JSON body, never a stack trace. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data } satisfies ApiResult<T>, init);
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message, details } } satisfies ApiResult,
    { status }
  );
}

/** Strip opaque IDs from paths so telemetry never carries user/customer identifiers. */
export function redactRoute(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id")
    .replace(/\/[A-Za-z0-9_-]{24,}/g, "/:id");
}

/**
 * Wrap a route handler with uniform error handling:
 * ApiError -> structured status; ZodError -> 400 VALIDATION_ERROR;
 * anything else -> generic 500 (no internals leaked to the client).
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err.status, err.code, err.message, err.details);
      }
      if (err instanceof ZodError) {
        return fail(400, "VALIDATION_ERROR", "Invalid request.", err.flatten());
      }
      const request = args[0];
      const route =
        request instanceof Request
          ? redactRoute(new URL(request.url).pathname)
          : "unknown";
      if (isProduction) {
        // Log the error class only — messages can contain PII or credentials.
        console.error(
          JSON.stringify({
            level: "error",
            msg: "api.unhandled_error",
            route,
            error: err instanceof Error ? err.name : "UnknownError",
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        console.error("[api] unhandled error:", err);
      }
      return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  };
}

/** Parse and validate a request body with a Zod schema. */
export async function parseBody<S extends ZodSchema>(
  req: Request,
  schema: S
): Promise<ReturnType<S["parse"]>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.", "INVALID_JSON");
  }
  return schema.parse(json);
}

/** Parse and validate query params with a Zod schema. */
export function parseQuery<S extends ZodSchema>(
  url: URL,
  schema: S
): ReturnType<S["parse"]> {
  const params = Object.fromEntries(url.searchParams.entries());
  return schema.parse(params);
}

/** Best-effort client IP (hashing happens upstream where needed). */
export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/** Route context shape used by dynamic App Router handlers. */
export type RouteContext = { params: Promise<Record<string, string | string[]>> };

/**
 * Canonical route wrapper used by every handler under src/app/api.
 *
 * Keeps the success envelope (`{ ok: true, data }`) and error mapping in one
 * place, while remaining compatible with static and dynamic routes:
 *
 *   export const GET = apiHandler(async (request) => jsonOk({ ... }));
 *   export const GET = apiHandler(async (request, context) => { ... });
 *
 * Also logs method, route, status, and latency for every request (no PII).
 */
export function apiHandler<C = RouteContext>(
  handler: (request: Request, context: C) => Promise<Response> | Response
): (request: Request, context: C) => Promise<Response> {
  const guarded = withErrorHandling(async (request: Request, context: C) => handler(request, context));

  return async (request: Request, context: C): Promise<Response> => {
    const started = Date.now();
    let status = 500;
    try {
      const response = await guarded(request, context);
      status = response.status;
      return response;
    } finally {
      const latency = Date.now() - started;
      const logEntry = {
        level: status >= 500 ? "error" : "info",
        msg: "api.request",
        method: request.method,
        route: redactRoute(new URL(request.url).pathname),
        status,
        latencyMs: latency,
        timestamp: new Date().toISOString(),
      };
      if (isProduction) {
        console.log(JSON.stringify(logEntry));
      } else {
        console.log(`[api] ${logEntry.method} ${logEntry.route} -> ${status} in ${latency}ms`);
      }
    }
  };
}

/** Success envelope: `{ ok: true, data }`. */
export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return ok(data, init);
}

/** Parse + validate a JSON body (alias kept for route-level readability). */
export function readJson<S extends ZodSchema>(req: Request, schema: S): Promise<ReturnType<S["parse"]>> {
  return parseBody(req, schema);
}
